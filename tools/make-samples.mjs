/**
 * Generate the deliberately-broken sample files the prospect demo hands out.
 *
 *   node tools/make-samples.mjs
 *
 * A prospect never has a bad file to hand, and their own good artwork passing
 * proves nothing to them. These are the three failures that actually cause
 * reprints, so the demo can be tried in one click.
 *
 * Deterministic and dependency-free — re-run to recreate. Committed output
 * lives in public/samples/.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');
mkdirSync(out, { recursive: true });

/* ── minimal PDF writer (same shape as the e2e fixture generator) ──────── */

const buildPdf = (objects) => {
    let body = '%PDF-1.7\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(body));
        body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(body);
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(body, 'latin1');
};

const stream = (content) => `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;

/**
 * One page at `mediaBox`, with artwork inset by `inset` points on every edge.
 * A real print file bleeds PAST the trim; these stop short of it or land on it
 * exactly, which is precisely the failure.
 */
const page = (wPt, hPt, inset, label) => buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream([
        // Artwork block — deliberately inset, so nothing runs to the edge.
        `0.15 0.42 0.85 rg ${inset} ${inset} ${wPt - inset * 2} ${hPt - inset * 2} re f`,
        `BT /F1 ${Math.max(9, Math.round(hPt / 22))} Tf 1 1 1 rg ${inset + 12} ${hPt / 2} Td (${label}) Tj ET`,
    ].join('\n')),
]);

const mm = (v) => Math.round(v * 72 / 25.4);

writeFileSync(join(out, 'nobleed.pdf'),
    page(mm(1219.2), mm(609.6), 0, 'Artwork stops exactly at the trim - no bleed'));

writeFileSync(join(out, 'wrongsize.pdf'),
    page(mm(210), mm(297), 8, 'A4 artwork supplied for a large-format print'));

/* ── minimal PNG writer ───────────────────────────────────────────────── */

const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();
const crc32 = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};

/** A deliberately tiny image — fine on screen, hopeless at print size. */
const lowResPng = (w, h) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 2;   // truecolour
    const raw = Buffer.alloc(h * (1 + w * 3));
    for (let y = 0; y < h; y++) {
        const row = y * (1 + w * 3);
        raw[row] = 0;                       // filter: none
        for (let x = 0; x < w; x++) {
            const p = row + 1 + x * 3;
            // A soft gradient, so scaling artefacts are obvious.
            raw[p]     = Math.round(40 + (x / w) * 180);
            raw[p + 1] = Math.round(90 + (y / h) * 120);
            raw[p + 2] = 210;
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};

// 300 × 150 px across a 1.2 m banner is ~6 dpi — the classic phone-photo upload.
writeFileSync(join(out, 'lowres.png'), lowResPng(300, 150));

console.log('wrote public/samples/: nobleed.pdf, wrongsize.pdf, lowres.png');
