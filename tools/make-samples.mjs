/**
 * Generate the deliberately-broken sample files the prospect demo hands out.
 *
 *   node tools/make-samples.mjs
 *
 * A prospect never has a bad file to hand, and their own good artwork passing
 * proves nothing to them. These are the three failures that actually cause
 * reprints, so the demo can be tried in one click.
 *
 * Deterministic and dependency-free, re-run to recreate. Committed output
 * lives in public/samples/.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
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
        // Artwork block; deliberately inset, so nothing runs to the edge.
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

/** A deliberately tiny image; fine on screen, hopeless at print size. */
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

// 300 × 150 px across a 1.2 m banner is ~6 dpi, the classic phone-photo upload.
writeFileSync(join(out, 'lowres.png'), lowResPng(300, 150));

/* ── multi-page PDF builder (for the Print Options pilots) ────────────── */

/**
 * Build a PDF from N pages, each `{ wPt, hPt, trimInsetPt, content }`.
 * Vector-only content on purpose: no fonts to embed, no rasters to measure,
 * so a sample intended to PASS passes without unrelated warnings.
 */
const docPdf = (pages) => {
    const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    ];
    for (const p of pages) {
        const inset = p.trimInsetPt ?? 0;
        const boxes = inset > 0
            ? ` /TrimBox [${inset} ${inset} ${p.wPt - inset} ${p.hPt - inset}]`
            : '';
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.wPt} ${p.hPt}]${boxes} /Contents ${objects.length + 2} 0 R >>`,
            stream(p.content),
        );
    }
    return buildPdf(objects);
};

/* Flyer pilot: A5 with a correct 3 mm bleed on every edge. Artwork covers the
   whole MediaBox, TrimBox sits 3 mm inside it; exactly what the flyer demo's
   default check wants, so this file passes as uploaded. */
{
    const b = mm(3);
    const w = mm(148) + b * 2;
    const h = mm(210) + b * 2;
    writeFileSync(join(out, 'flyer-a5.pdf'), docPdf([{
        wPt: w, hPt: h, trimInsetPt: b,
        content: [
            `0.90 0.35 0.05 rg 0 0 ${w} ${h} re f`,                                  // bleeds
            `1 1 1 rg ${b + mm(10)} ${b + mm(10)} ${w - b * 2 - mm(20)} ${h - b * 2 - mm(20)} re f`,
            `0.15 0.42 0.85 rg ${b + mm(20)} ${h / 2 - mm(15)} ${w - b * 2 - mm(40)} ${mm(30)} re f`,
        ].join('\n'),
    }]));
}

/* Thesis pilot: 48 A4 pages, 12 of them with CMY ink (every 4th page), the
   rest DeviceGray only; so the colour/mono split the pricing engine charges
   from is unambiguous: 12 colour, 36 mono. */
{
    const w = mm(210);
    const h = mm(297);
    const pages = [];
    for (let i = 0; i < 48; i++) {
        const colour = i % 4 === 0; // pages 1, 5, 9, …, 12 in total
        const bars = [];
        // A "text block": rows of gray bars, headline bar on top.
        bars.push(colour
            ? `0.15 0.42 0.85 rg ${mm(25)} ${h - mm(40)} ${mm(120)} ${mm(8)} re f`
            : `0.15 g ${mm(25)} ${h - mm(40)} ${mm(120)} ${mm(8)} re f`);
        for (let row = 0; row < 14; row++) {
            const y = h - mm(60) - row * mm(14);
            bars.push(`0.45 g ${mm(25)} ${y} ${mm(160) - (row % 3) * mm(18)} ${mm(4)} re f`);
        }
        if (colour) {
            // The "figure" that makes this page a colour page.
            bars.push(`0.90 0.35 0.05 rg ${mm(40)} ${mm(30)} ${mm(60)} ${mm(35)} re f`);
            bars.push(`0.10 0.65 0.35 rg ${mm(105)} ${mm(30)} ${mm(60)} ${mm(35)} re f`);
        }
        pages.push({ wPt: w, hPt: h, content: bars.join('\n') });
    }
    writeFileSync(join(out, 'thesis-48p-mixed.pdf'), docPdf(pages));
}

/* ── per-product samples for the Print Options catalog ────────────────── */

/** A trim-size page with proper bleed: art covers the whole MediaBox. */
const bledPage = (trimWmm, trimHmm, bleedMm, deco = []) => {
    const b = mm(bleedMm);
    const w = mm(trimWmm) + b * 2;
    const h = mm(trimHmm) + b * 2;
    return {
        wPt: w, hPt: h, trimInsetPt: b,
        content: [
            `0.90 0.35 0.05 rg 0 0 ${w} ${h} re f`,
            `1 1 1 rg ${b + mm(8)} ${b + mm(8)} ${w - b * 2 - mm(16)} ${h - b * 2 - mm(16)} re f`,
            ...deco.map(([x, y, dw, dh, colour]) =>
                `${colour} ${b + mm(x)} ${b + mm(y)} ${mm(dw)} ${mm(dh)} re f`),
        ].join('\n'),
    };
};

/** A page whose art stops short of the trim, the no-bleed classic. */
const drySheet = (wMm, hMm, insetMm) => {
    const w = mm(wMm);
    const h = mm(hMm);
    const i = mm(insetMm);
    return {
        wPt: w, hPt: h,
        content: `0.15 0.42 0.85 rg ${i} ${i} ${w - i * 2} ${h - i * 2} re f`,
    };
};

// Business cards: one passes, one has no bleed.
writeFileSync(join(out, 'card-good.pdf'),
    docPdf([bledPage(85, 55, 3, [[10, 32, 40, 8, '0.15 0.42 0.85 rg'], [10, 12, 55, 4, '0.45 g']])]));
writeFileSync(join(out, 'card-nobleed.pdf'), docPdf([drySheet(85, 55, 4)]));

// Folded leaflet: two landscape A4 spreads (pass) and the one-page mistake.
writeFileSync(join(out, 'leaflet-trifold.pdf'), docPdf([
    bledPage(297, 210, 3, [[20, 90, 80, 30, '0.15 0.42 0.85 rg'], [119, 90, 80, 30, '0.10 0.65 0.35 rg'], [218, 90, 60, 30, '0.45 g']]),
    bledPage(297, 210, 3, [[20, 60, 257, 8, '0.45 g'], [20, 90, 257, 8, '0.45 g'], [20, 120, 257, 8, '0.45 g']]),
]));
writeFileSync(join(out, 'leaflet-onepage.pdf'),
    docPdf([bledPage(297, 210, 3)]));

// Saddle booklet: 16 A5 pages (pass) and 13 (not a multiple of four).
const bookletPages = (n) => Array.from({ length: n }, (_, i) => ({
    wPt: mm(148), hPt: mm(210),
    content: [
        `0.15 g ${mm(15)} ${mm(180)} ${mm(80 + (i % 3) * 10)} ${mm(6)} re f`,
        ...Array.from({ length: 10 }, (_, row) =>
            `0.45 g ${mm(15)} ${mm(160 - row * 13)} ${mm(118 - (row % 4) * 12)} ${mm(3)} re f`),
    ].join('\n'),
}));
writeFileSync(join(out, 'booklet-16p.pdf'), docPdf(bookletPages(16)));
writeFileSync(join(out, 'booklet-13p.pdf'), docPdf(bookletPages(13)));

// Banners: the default 3 × 1 m (pass), and a big one that crosses a tier break.
writeFileSync(join(out, 'banner-3x1m.pdf'), docPdf([bledPage(3000, 1000, 25)]));
writeFileSync(join(out, 'banner-large.pdf'), docPdf([bledPage(4500, 1800, 25)]));

// Poster: A1 with 5 mm bleed.
writeFileSync(join(out, 'poster-a1.pdf'), docPdf([bledPage(594, 841, 5)]));

// Roll-up: correct file includes the 150 mm cassette tail; the classic
// mistake is sized to the visible area only.
{
    const w = mm(850);
    const h = mm(2150);
    writeFileSync(join(out, 'rollup-correct.pdf'), docPdf([{
        wPt: w, hPt: h,
        content: [
            `0.90 0.35 0.05 rg 0 0 ${w} ${h} re f`,
            `1 1 1 rg ${mm(40)} ${mm(190)} ${w - mm(80)} ${h - mm(230)} re f`,
            // The tail band nothing important may enter.
            `0.75 g 0 0 ${w} ${mm(150)} re f`,
        ].join('\n'),
    }]));
    writeFileSync(join(out, 'rollup-2000.pdf'), docPdf([{
        wPt: w, hPt: mm(2000),
        content: `0.90 0.35 0.05 rg 0 0 ${w} ${mm(2000)} re f`,
    }]));
}

// Mug: the 11 oz wrap template, exact.
writeFileSync(join(out, 'mug-wrap-11oz.pdf'), docPdf([{
    wPt: mm(200), hPt: mm(85),
    content: [
        `0.90 0.35 0.05 rg 0 0 ${mm(200)} ${mm(85)} re f`,
        `1 1 1 rg ${mm(15)} ${mm(12)} ${mm(170)} ${mm(61)} re f`,
        `0.15 0.42 0.85 rg ${mm(70)} ${mm(30)} ${mm(60)} ${mm(25)} re f`,
    ].join('\n'),
}]));

/* ── generic PNG writer (RGB or RGBA) ─────────────────────────────────── */

const makePng = (w, h, pixelFn, withAlpha = false) => {
    const bpp = withAlpha ? 4 : 3;
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = withAlpha ? 6 : 2;
    const raw = Buffer.alloc(h * (1 + w * bpp));
    for (let y = 0; y < h; y++) {
        const row = y * (1 + w * bpp);
        raw[row] = 0;
        for (let x = 0; x < w; x++) {
            const p = row + 1 + x * bpp;
            const [r, g, b, a] = pixelFn(x, y);
            raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
            if (withAlpha) raw[p + 3] = a;
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};

/** The same "logo" twice: transparent background vs the flat white box. */
const logoPixel = (x, y, size) => {
    const cx = size / 2, cy = size / 2;
    const d = Math.hypot(x - cx, y - cy);
    if (d < size * 0.32 && d > size * 0.18) return [217, 62, 30];   // ring
    if (Math.abs(x - cx) < size * 0.05 && Math.abs(y - cy) < size * 0.3) return [22, 60, 130]; // bar
    return null;
};
writeFileSync(join(out, 'logo-transparent.png'), makePng(1200, 1200, (x, y) => {
    const p = logoPixel(x, y, 1200);
    return p ? [...p, 255] : [0, 0, 0, 0];
}, true));
writeFileSync(join(out, 'logo-whitebg.png'), makePng(1200, 1200, (x, y) => {
    const p = logoPixel(x, y, 1200);
    return p ? p : [255, 255, 255];
}));

// Mug: a square image for a 40:17 wrap, the aspect warning.
writeFileSync(join(out, 'mug-square.png'), makePng(900, 900, (x, y) => [
    Math.round(40 + (x / 900) * 180), Math.round(90 + (y / 900) * 120), 210,
]));

// Photo canvas: a portrait 3:4 "photo" and a panorama that will not fit.
const photoPixel = (w, h) => (x, y) => [
    Math.round(30 + (y / h) * 120),
    Math.round(70 + (x / w) * 110 - (y / h) * 40),
    Math.round(160 - (y / h) * 90),
];
writeFileSync(join(out, 'photo-3x4.png'), makePng(900, 1200, photoPixel(900, 1200)));
writeFileSync(join(out, 'photo-pano.png'), makePng(2000, 600, photoPixel(2000, 600)));

/* ── encrypted PDF (standard security handler, R2 / 40-bit RC4) ───────── */

const PAD = Buffer.from([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56,
    0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
]);
const padPw = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32);
const md5 = (...parts) => createHash('md5').update(Buffer.concat(parts)).digest();
const rc4 = (key, data) => {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    for (let i = 0, j = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) & 0xFF;
        [S[i], S[j]] = [S[j], S[i]];
    }
    const outBuf = Buffer.alloc(data.length);
    for (let n = 0, i = 0, j = 0; n < data.length; n++) {
        i = (i + 1) & 0xFF;
        j = (j + S[i]) & 0xFF;
        [S[i], S[j]] = [S[j], S[i]];
        outBuf[n] = data[n] ^ S[(S[i] + S[j]) & 0xFF];
    }
    return outBuf;
};

/**
 * Thesis pilot: a password-protected PDF. The USER password is empty, so any
 * viewer opens it without prompting and any uploader accepts it, but the
 * encryption dictionary is real, which is exactly what jams RIPs and what
 * `struct.encryption_allowed` rejects. Owner password: "filecheck-demo".
 */
const encryptedPdf = () => {
    const w = mm(210);
    const h = mm(297);
    const P = -44; // permissions bitmask (print allowed); any legal value will do
    const pInt = Buffer.alloc(4);
    pInt.writeInt32LE(P);
    const id = randomBytes(16);

    // Algorithm 3.3: /O from the owner password.
    const ownerKey = md5(padPw('filecheck-demo')).subarray(0, 5);
    const O = rc4(ownerKey, padPw(''));
    // Algorithm 3.2: the file encryption key (empty user password).
    const encKey = md5(padPw(''), O, pInt, id).subarray(0, 5);
    // Algorithm 3.4 (R2): /U is the padding encrypted with the file key.
    const U = rc4(encKey, PAD);

    const objKey = (num) => {
        const extra = Buffer.from([num & 0xFF, (num >> 8) & 0xFF, (num >> 16) & 0xFF, 0, 0]);
        return md5(encKey, extra).subarray(0, Math.min(encKey.length + 5, 16));
    };

    const content = [
        `0.92 g 0 0 ${w} ${h} re f`,
        `0.35 g ${mm(30)} ${h - mm(60)} ${mm(150)} ${mm(10)} re f`,
        `0.55 g ${mm(30)} ${h - mm(80)} ${mm(120)} ${mm(6)} re f`,
    ].join('\n');
    const encContent = rc4(objKey(5), Buffer.from(content, 'latin1'));

    const hex = (buf) => `<${buf.toString('hex').toUpperCase()}>`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 5 0 R >>`,
        `<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>`,
        `<< /Length ${encContent.length} >>\nstream\n${encContent.toString('latin1')}\nendstream`,
    ];

    let body = '%PDF-1.7\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(Buffer.byteLength(body, 'latin1'));
        body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(body, 'latin1');
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R ` +
        `/ID [${hex(id)} ${hex(id)}] >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(body, 'latin1');
};

writeFileSync(join(out, 'thesis-locked.pdf'), encryptedPdf());

console.log('wrote public/samples/: nobleed.pdf, wrongsize.pdf, lowres.png, ' +
    'flyer-a5.pdf, thesis-48p-mixed.pdf, thesis-locked.pdf, card-good.pdf, ' +
    'card-nobleed.pdf, leaflet-trifold.pdf, leaflet-onepage.pdf, booklet-16p.pdf, ' +
    'booklet-13p.pdf, banner-3x1m.pdf, banner-large.pdf, poster-a1.pdf, ' +
    'rollup-correct.pdf, rollup-2000.pdf, mug-wrap-11oz.pdf, mug-square.png, ' +
    'logo-transparent.png, logo-whitebg.png, photo-3x4.png, photo-pano.png');
