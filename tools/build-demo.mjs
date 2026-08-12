/**
 * Build the demo site for BOTH deploy targets:
 *
 *   dist/        base '/'        -> s3://demo-filecheck-io (root)        -> demo.filecheck.io
 *   dist-demos/  base '/demos/'  -> s3://demo-filecheck-io/demos/       -> filecheck.io/demos
 *
 * Each build then gets its static per-product pages from
 * make-product-pages.mjs. One script rather than npm-script env prefixes
 * because `VAR=x vite build` does not survive Windows shells.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const viteBin = join(pkgRoot, 'node_modules', 'vite', 'bin', 'vite.js');

/* Self-host the Print Options widget (see vite.config.ts on why): copy the
   built bundle into public/ so both dists ship it same-origin. */
const PO_DIST = process.env.PO_DIST ?? resolve(
    pkgRoot, '..', '..', '..', '..',
    'pa', 'product-options', 'packages', 'core-ui', 'dist', 'print-configurator.js',
);
if (!existsSync(PO_DIST)) {
    throw new Error(
        `print-configurator.js not found at ${PO_DIST}\n` +
        'Build it (pnpm --filter @product-options/core-ui build) or set PO_DIST.',
    );
}
mkdirSync(join(pkgRoot, 'public', 'po'), { recursive: true });
copyFileSync(PO_DIST, join(pkgRoot, 'public', 'po', 'print-configurator.js'));
console.log(`synced widget bundle from ${PO_DIST}`);

const build = (base, outDir) => {
    console.log(`\n=== vite build  base=${base}  outDir=${outDir} ===`);
    execFileSync(process.execPath, [viteBin, 'build', '--outDir', outDir, '--emptyOutDir'], {
        cwd: pkgRoot,
        stdio: 'inherit',
        env: { ...process.env, VITE_BASE: base },
    });
    execFileSync(process.execPath, [join(here, 'make-product-pages.mjs'), join(pkgRoot, outDir), base], {
        cwd: pkgRoot,
        stdio: 'inherit',
    });
};

build('/', 'dist');
build('/demos/', 'dist-demos');
console.log('\nboth builds complete.');
