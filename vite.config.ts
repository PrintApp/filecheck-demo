import { defineConfig, Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

export default defineConfig({
    plugins: [serveElementBundle()],
    server: {
        port: 5174,
        host: '0.0.0.0',
        fs: {
            // Demo needs to read sibling packages/element/dist/.
            allow: [resolve(__dirname, '..', '..')],
        },
    },
});
