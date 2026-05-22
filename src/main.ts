/**
 * Demo wiring.
 *
 * Intentionally empty. All integration logic — mount target resolution,
 * cart-button gating, modal trigger, customJs/Css injection — lives in
 * the Element's auto-bootstrap (driven by `FILECHECK_ELEMENT_CONFIG`,
 * which `index.html` sets inline to simulate the per-tenant CDN edge).
 *
 * Kept as a module so the demo's build pipeline still has an entry
 * point and to leave a hook for future demo-only experimentation.
 */
export {};
