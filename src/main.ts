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
type IntakeStatusPayload = {
    status:     'idle' | 'incomplete' | 'uploading' | 'processing' | 'ready' | 'partial' | 'rejected';
    terminal:   boolean;
    canProceed: boolean;
    ruleId:     string | null;
    jobId:      string | null;
    files:      Array<{ id: string; name: string; outcome: 'pass' | 'warn' | 'fail' | null; status: string }>;
};

type IntakeElement = {
    mount:   (target: string | Element) => void;
    unmount: () => void;
    destroy: () => void;
    on:      (event: 'ready' | 'status' | 'ui' | 'error', fn: (e: any) => void) => () => void;
    off:     (event: 'ready' | 'status' | 'ui' | 'error', fn: (e: any) => void) => void;
};

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
                ) => IntakeElement;
            };
        };
    }
}

const DEFAULT_PUBLISHABLE_KEY = 'pk_test_demo';

// URL overrides (so a single deployed demo can swap tenant/rule
// without rebuilding):
//   ?pk=dom_01ABC...       publishable / domain key
//   ?rule=rul_01XYZ...     intake rule (falls back to domain default)
const params = new URLSearchParams(location.search);
const PUBLISHABLE_KEY = params.get('pk') ?? DEFAULT_PUBLISHABLE_KEY;
const RULE_ID         = params.get('rule') ?? undefined;

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

    const createOpts = RULE_ID ? { ruleId: RULE_ID } : undefined;

    // ── add-to-cart gating ──
    // The element emits `status` on every intake-status transition. Its
    // `canProceed` flag has already been collapsed inside the iframe
    // from the resolved rule's `policy.onFail` (so a failed file under
    // `onFail=reject` gives canProceed=false; the same failed file
    // under `onFail=accept_with_warnings` gives canProceed=true).
    //
    // Track each element separately so either uploader can satisfy the
    // gate — the customer might use inline OR modal, not necessarily
    // both.
    const addToCart = document.getElementById('add-to-cart') as HTMLButtonElement;
    const canProceedBy = new Map<string, boolean>();
    const refreshGate = () => {
        const ok = [...canProceedBy.values()].some(Boolean);
        addToCart.disabled = !ok;
    };
    const bindGate = (el: IntakeElement, key: string) => {
        canProceedBy.set(key, false);
        el.on('status', (e: IntakeStatusPayload) => {
            canProceedBy.set(key, e.canProceed);
            refreshGate();
        });
    };

    // ── inline ──
    const inline = fc.elements.create('intake', createOpts);
    bindGate(inline, 'inline');
    inline.mount('#fc-inline');

    // ── modal ──
    const dialog = document.getElementById('uploader-dialog') as HTMLDialogElement;
    const openBtn = document.getElementById('open-uploader')!;
    const closeBtn = document.getElementById('close-uploader')!;

    let modalElement: IntakeElement | null = null;

    openBtn.addEventListener('click', () => {
        if (!modalElement) {
            modalElement = fc.elements.create('intake', createOpts);
            bindGate(modalElement, 'modal');
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
