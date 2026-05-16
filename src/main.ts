/**
 * Demo page wiring. Two integrations of the same element:
 *
 *   1. INLINE  — created on page load, mounted into #fc-inline.
 *   2. MODAL   — created lazily on the first "Upload Files" click,
 *                mounted into #fc-modal which lives inside a <dialog>.
 *
 * The `Filecheck` global is exposed by the IIFE bundle that the
 * <script async src="/element/filecheck.js"> tag in index.html loads.
 */

// The IIFE bundle attaches Filecheck to window. We declare its shape
// so TS is happy without importing the package (we want to prove the
// script-tag integration path works exactly as a tenant would use it).
declare global {
    interface Window {
        Filecheck: (
            publishableKey: string,
            options?: {
                agentId?: string | null;
                iframeSrc?: string;
            },
        ) => {
            elements: {
                create: (
                    type: 'intake',
                    options?: { ruleId?: string },
                ) => {
                    mount: (target: string | Element) => void;
                    unmount: () => void;
                    destroy: () => void;
                };
            };
        };
    }
}

const PUBLISHABLE_KEY = 'pk_test_demo';

// For local development point the iframe at the client dev server.
// In production this falls back to https://cdn.filecheck.io/client/v1/
// which is the package's built-in default.
const iframeSrc =
    import.meta.env.DEV ? 'http://localhost:8010/' : undefined;

/**
 * Wait until the async <script> tag has put `Filecheck` on window.
 * Simple polling avoids needing to coordinate a global "ready" event.
 */
function whenReady(): Promise<typeof window.Filecheck> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            if (typeof window.Filecheck === 'function') {
                return resolve(window.Filecheck);
            }
            if (Date.now() - started > 10_000) {
                return reject(new Error('Filecheck failed to load after 10s'));
            }
            setTimeout(tick, 50);
        };
        tick();
    });
}

async function main(): Promise<void> {
    const Filecheck = await whenReady();

    const fc = Filecheck(PUBLISHABLE_KEY, iframeSrc ? { iframeSrc } : {});

    // ── inline ──
    const inline = fc.elements.create('intake');
    inline.mount('#fc-inline');

    // ── modal ──
    const dialog = document.getElementById('uploader-dialog') as HTMLDialogElement;
    const openBtn = document.getElementById('open-uploader')!;
    const closeBtn = document.getElementById('close-uploader')!;

    let modalElement: ReturnType<typeof fc.elements.create> | null = null;

    openBtn.addEventListener('click', () => {
        if (!modalElement) {
            modalElement = fc.elements.create('intake');
            modalElement.mount('#fc-modal');
        }
        dialog.showModal();
    });

    closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => {
        // click on backdrop (the <dialog> itself, not its children)
        if (e.target === dialog) dialog.close();
    });
}

main().catch((err) => {
    console.error('[demo]', err);
});

export {};
