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

export default defineConfig(({ command }) => {
    // Feed the `%VITE_ELEMENT_SRC%` placeholder in the HTML entries. An
    // explicit env var wins; otherwise dev serves the local bundle and a build
    // points at the published CDN URL.
    process.env.VITE_ELEMENT_SRC =
        process.env.VITE_ELEMENT_SRC ??
        (command === 'serve' ? DEV_ELEMENT_SRC : PROD_ELEMENT_SRC);

    return {
        plugins: [serveElementBundle()],
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
