/**
 * Emit the static, crawlable product pages after a Vite build.
 *
 *   node tools/make-product-pages.mjs <distDir> <base>
 *   (called by tools/build-demo.mjs for both deploy bases)
 *
 * One `<dist>/<slug>/index.html` per catalog product, so every demo has a
 * clean URL (/flyers/, /demos/flyers/) with its own title, description and
 * canonical, and the try-it copy plus sample links live IN the HTML where
 * crawlers can read them. The page marks itself data-shop-prerendered, so
 * the shared shop-page.js runtime only mounts the configurator instead of
 * re-rendering chrome.
 *
 * Canonicals always point at https://filecheck.io/demos/<slug>/ regardless
 * of base: the same pages also ship on demo.filecheck.io, and search engines
 * should treat filecheck.io as the one true home. A sitemap.xml is emitted
 * only for the /demos/ build for the same reason.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const distDir = resolve(process.argv[2] ?? join(pkgRoot, 'dist'));
const base = process.argv[3] ?? '/';

const CANONICAL_ROOT = 'https://filecheck.io/demos/';
// Element: classic script, safe cross-origin, loaded from the Filecheck CDN.
const ELEMENT_SRC = process.env.VITE_ELEMENT_SRC?.startsWith('http')
    ? process.env.VITE_ELEMENT_SRC
    : 'https://cdn.filecheck.io/element/v1/filecheck.js';

const catalog = JSON.parse(readFileSync(join(pkgRoot, 'public', 'catalog.json'), 'utf8'));

// The built stylesheet carries a content hash; find it in the dist output.
const styles = readdirSync(join(distDir, 'assets')).find(f => /^styles-.*\.css$/.test(f));
if (!styles) throw new Error(`no built stylesheet found in ${join(distDir, 'assets')}`);

const esc = (s) => String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const description = (entry) => {
    const s = `${entry.blurb || entry.copy} A live Filecheck demo: upload a file and watch it checked against the product options, with the price computed from what the check finds.`;
    return s.length > 158 ? s.slice(0, 155).replace(/\s+\S*$/, '') + '…' : s;
};

const NAV = [
    ['', '← All demos'],
    ['flyers/', 'Flyers'],
    ['thesis/', 'Thesis'],
    ['stickers/', 'Stickers'],
    ['banner/', 'Banner'],
    ['tshirt/', 'T-shirt'],
    ['freetool.html', 'Free tool'],
];

const page = (slug, entry) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(entry.title)} demo · ${esc(entry.brand)} · Filecheck</title>
    <meta name="description" content="${esc(description(entry))}" />
    <link rel="canonical" href="${CANONICAL_ROOT}${slug}/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(entry.title)} demo · Filecheck" />
    <meta property="og:description" content="${esc(entry.blurb || entry.copy)}" />
    <meta property="og:url" content="${CANONICAL_ROOT}${slug}/" />
    <link rel="stylesheet" href="${base}assets/${styles}" />
    <link rel="icon" type="image/png" href="${base}icon.png" />
    <script>window.__FC_ENV__ = { base: '${base}', clean: '1' }; window.__FC_PRODUCT__ = '${slug}';</script>
    <script src="${base}demo.js"></script>
    <script src="${ELEMENT_SRC}"></script>
    <script type="module" src="${base}po/print-configurator.js"></script>
</head>
<body data-shop-prerendered>
    <nav class="demo-bar">
${NAV.map(([href, label]) => `        <a href="${base}${href}">${esc(label)}</a>`).join('\n')}
    </nav>

    <header class="site-header">
        <div class="logo" data-shop-brand>${esc(entry.brand)}</div>
        <nav>
            <a class="nav-cta nav-cta-red" target="_blank" href="https://admin.filecheck.io/register">Get Filecheck <span aria-hidden="true">→</span></a>
            <a href="#">Shop</a>
            <a href="#">Help</a>
            <a href="#" class="cart">Cart (0)</a>
        </nav>
    </header>

    <main class="product product-hero-layout">
        <section class="product-hero">
            <div class="product-strip">
                <div class="product-swatch product-swatch-strip ${esc(entry.swatchClass || '')}" data-shop-swatch aria-hidden="true">${esc(entry.swatch || entry.title)}</div>
                <div class="product-strip-id">
                    <p class="breadcrumb" data-shop-breadcrumb>${esc(entry.breadcrumb)}</p>
                    <h1 data-shop-title>${esc(entry.title)}</h1>
                </div>
            </div>

            <div class="fc-hero">
                <h2 class="fc-hero-label" data-fc-hero-label>${esc(entry.uploadLabel || 'Upload your artwork')}</h2>
                <p class="fc-hero-hint" data-fc-hero-hint>${esc(entry.uploadHint || '')}</p>
                <div id="fc-hero-slot"></div>
            </div>

            <div class="try-box" data-shop-try>
                <h2>Try it</h2>
                <ol data-shop-try-steps>
${(entry.tryIt || []).map(step => `                    <li>${esc(step)}</li>`).join('\n')}
                </ol>
                <p class="try-samples-title">Sample files</p>
                <ul class="sample-links" data-shop-samples>
${(entry.samples || []).map(s => `                    <li><a href="${base}${esc(String(s.href).replace(/^\/+/, ''))}" download>${esc(s.label)}</a></li>`).join('\n')}
                </ul>
            </div>
        </section>

        <section class="product-rail">
            <p class="copy" data-shop-copy>${esc(entry.copy)}</p>

            <div id="po-slot"></div>

            <p class="hint">
                Change any option and Filecheck re-checks the same file without
                re-uploading. Add <code>?fcdebug=1</code> to the URL to see what
                it is told about your selections.
            </p>

            <details class="integration">
                <summary>How this page is wired</summary>
                <p>
                    The Filecheck element owns the page; the Print Options form
                    reacts over its public Page API. The blueprint (one JSON
                    document) still declares both: the options with their
                    prices, and the inline Filecheck workflow this page runs.
                </p>
<pre><code>intake.on('status', s =&gt; {
  po.setFile(factsOf(s));          // facts reprice the form
  s.canProceed ? po.releaseHold('filecheck')
               : po.addHold('filecheck');
});
po.addEventListener('change', e =&gt;
  intake.setContext(contextOf(e))); // selections re-check the file</code></pre>
                <p>
                    <a data-shop-config-link href="${base}${esc(String(entry.config).replace(/^\/+/, ''))}">View the raw
                    blueprint&nbsp;+&nbsp;workflow</a>.
                </p>
            </details>
        </section>
    </main>

    <script src="${base}shop-page.js"></script>
</body>
</html>
`;

const slugs = Object.keys(catalog.products);
for (const slug of slugs) {
    const entry = { ...catalog.products[slug] };
    // The hero card's label/hint come from the blueprint's own file field,
    // same place the runtime reads them on shop.html.
    try {
        const config = JSON.parse(readFileSync(
            join(pkgRoot, 'public', String(entry.config).replace(/^\/+/, '')), 'utf8'));
        const fileField = config.sections.flatMap(s => s.fields)
            .find(f => f.type === 'file' && f.providerId === 'filecheck');
        if (fileField) {
            entry.uploadLabel = fileField.label;
            entry.uploadHint = fileField.helpText;
        }
    } catch { /* page still renders with the generic label */ }
    const dir = join(distDir, slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), page(slug, entry));
}

if (base === '/demos/') {
    const today = new Date().toISOString().slice(0, 10);
    // Product pages only: /demos/ itself 301s to the /demos gateway page,
    // which the website's own sitemap already covers.
    const urls = slugs.map(s => `${CANONICAL_ROOT}${s}/`);
    writeFileSync(join(distDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
        `\n</urlset>\n`);
}

console.log(`wrote ${slugs.length} product pages to ${distDir} (base ${base})` +
    (base === '/demos/' ? ' + sitemap.xml' : ''));
