import { defineConfig, Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * The path the demo HTML loads the element bundle from, injected into the
 * `%VITE_ELEMENT_SRC%` placeholder in each HTML entry.
 *
 * - **dev**: `/element/filecheck.js` — served by the middleware below straight
 *   from `packages/element/dist/filecheck.js` (no CDN round-trip).
 * - **build/prod**: the public CDN URL, so the deployed demo loads the real
 *   published bundle instead of a root-relative path that doesn't exist on S3.
 *
 * Override either with a `VITE_ELEMENT_SRC` env var (e.g. to point a
 * production build at a staging bundle).
 */
const DEV_ELEMENT_SRC  = '/element/filecheck.js';
const PROD_ELEMENT_SRC  = 'https://cdn.filecheck.io/element/v1/filecheck.js';

/**
 * Same idea for the Print Options configurator bundle, used by the
 * `shop.html` combined demos (`%VITE_PO_SRC%` placeholder).
 *
 * - **dev**: served by middleware from the sibling product-options repo's
 *   local build, so widget changes show up without a CDN deploy.
 * - **build/prod**: SELF-HOSTED copy (tools/build-demo.mjs syncs it into
 *   public/po/). It is a module script, and cross-origin module loads from
 *   options.print.app hit the same CORS cache-variant poisoning that made
 *   the storefront adapters self-host — same cure here. Relative path so
 *   it works at both deploy bases.
 */
const DEV_PO_SRC  = '/po/print-configurator.js';
const PROD_PO_SRC = '/po/print-configurator.js';

/** Where the product-options repo's built widget lives on this machine. */
const PO_DIST_DEFAULT = resolve(
    __dirname, '..', '..', '..', '..',
    'pa', 'product-options', 'packages', 'core-ui', 'dist', 'print-configurator.js',
);

/**
 * Serves the freshly-built IIFE bundle from
 * `packages/element/dist/filecheck.js` at the same path the public CDN
 * exposes:  /element/filecheck.js
 *
 * Run `pnpm --filter @filecheck/element dev` in a second terminal so the
 * bundle stays up to date while you tweak the element source.
 */
function serveElementBundle(): Plugin {
    const bundlePath = resolve(__dirname, '..', 'element', 'dist', 'filecheck.js');

    return {
        name: 'demo:serve-element-bundle',
        configureServer(server) {
            server.middlewares.use('/element/filecheck.js', async (_req, res) => {
                try {
                    const body = await readFile(bundlePath);
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(body);
                } catch (err) {
                    res.statusCode = 404;
                    res.end(
                        `// filecheck.js not built yet — run\n` +
                        `//   pnpm --filter @filecheck/element build\n` +
                        `// (error: ${(err as Error).message})\n`,
                    );
                }
            });
        },
    };
}

/**
 * demo.filecheck.io (base '/') duplicates content whose canonical home is
 * filecheck.io/demos. The generated product pages carry a cross-host
 * canonical for that; the hand-written entry pages have none, so the
 * demo-host build marks them noindex to keep the host out of search.
 * The '/demos/' build is untouched.
 */
function noindexDemoHost(base: string): Plugin {
    return {
        name: 'demo:noindex-demo-host',
        apply: 'build',
        transformIndexHtml(html) {
            if (base !== '/') return html;
            return html.replace(/<head>/i, '<head>\n    <meta name="robots" content="noindex">');
        },
    };
}

/**
 * Serves the product-options widget bundle at /po/print-configurator.js in
 * dev. Override the source path with a `PO_DIST` env var when the repos are
 * not siblings under the same root.
 */
function servePoBundle(): Plugin {
    const bundlePath = process.env.PO_DIST ?? PO_DIST_DEFAULT;

    return {
        name: 'demo:serve-po-bundle',
        configureServer(server) {
            server.middlewares.use('/po/print-configurator.js', async (_req, res) => {
                try {
                    const body = await readFile(bundlePath);
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(body);
                } catch (err) {
                    res.statusCode = 404;
                    res.end(
                        `// print-configurator.js not found at\n` +
                        `//   ${bundlePath}\n` +
                        `// Build it (pnpm --filter @product-options/core-ui build)\n` +
                        `// or set PO_DIST to the built file.\n` +
                        `// (error: ${(err as Error).message})\n`,
                    );
                }
            });
        },
    };
}

export default defineConfig(({ command }) => {
    // Feed the `%VITE_ELEMENT_SRC%` placeholder in the HTML entries. An
    // explicit env var wins; otherwise dev serves the local bundle and a build
    // points at the published CDN URL.
    process.env.VITE_ELEMENT_SRC =
        process.env.VITE_ELEMENT_SRC ??
        (command === 'serve' ? DEV_ELEMENT_SRC : PROD_ELEMENT_SRC);
    process.env.VITE_PO_SRC =
        process.env.VITE_PO_SRC ??
        (command === 'serve' ? DEV_PO_SRC : PROD_PO_SRC);

    // Deploy base. '/' for demo.filecheck.io (the default); '/demos/' when
    // building the copy served under filecheck.io/demos. Pages inject this
    // into window.__FC_ENV__ (see demo.js) so runtime URL building follows.
    const base = process.env.VITE_BASE ?? '/';
    process.env.VITE_BASE = base;
    // Builds link products by their clean static URLs (/flyers/); dev links
    // shop.html?product= because the static pages only exist in built output.
    process.env.VITE_CLEAN_URLS =
        process.env.VITE_CLEAN_URLS ?? (command === 'build' ? '1' : '');

    return {
        base,
        plugins: [serveElementBundle(), servePoBundle(), noindexDemoHost(base)],
        build: {
            // Every demo page must be listed here or it simply is not built —
            // Vite's default is index.html alone, which is why the extra pages
            // worked in `pnpm dev` and were missing from the deployed site.
            rollupOptions: {
                input: {
                    index:         resolve(__dirname, 'index.html'),
                    businessCards: resolve(__dirname, 'business-cards.html'),
                    pvcBanner:     resolve(__dirname, 'pvc-banner.html'),
                    brochure:      resolve(__dirname, 'brochure.html'),
                    freetool:      resolve(__dirname, 'freetool.html'),
                    report:        resolve(__dirname, 'report.html'),
                    // Combined Filecheck × Print Options demos. One page,
                    // many products — ?product=<slug> picks the blueprint.
                    shop:          resolve(__dirname, 'shop.html'),
                    // Prospect samples. One page, many configs — deliberately
                    // NOT linked from the landing page; the link is emailed.
                    clientSample:  resolve(__dirname, 'client-sample.html'),
                },
            },
        },
        server: {
            port: 5174,
            host: '0.0.0.0',
            fs: {
                // Demo needs to read sibling packages/element/dist/.
                allow: [resolve(__dirname, '..', '..')],
            },
        },
    };
});
