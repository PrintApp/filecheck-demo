/**
 * Emit the combined Filecheck × Print Options demo configs.
 *
 *   node tools/make-po-configs.mjs
 *
 * Writes `public/configs/po/demo-<slug>.json`, one self-contained blueprint
 * per product, each carrying its transient inline Filecheck workflow on the
 * file field. The two pilots (flyer-sizes, thesis-per-page) were hand-authored
 * first and are NOT regenerated here; this script owns the other eleven.
 *
 * Why a generator: the workflow envelope (trigger/intake/merge/proofing/…)
 * is identical boilerplate for every product, and drift in it is exactly the
 * kind of bug nobody spots until a demo silently stops gating. The per-product
 * truth; options, prices, rules, context patches, stays right here, compact
 * enough to review in one screen per product.
 *
 * After editing, re-verify every config:
 *   node <product-options>/docs/blueprint-authoring/check.mjs public/configs/po/demo-<slug>.json
 * (expected totals live in product-options docs/blueprint-authoring/samples/manifest.json)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'configs', 'po');
mkdirSync(out, { recursive: true });

/* ── shared builders ──────────────────────────────────────────────────── */

/** Preflight profile from a compact {sectionId: {ruleId: {severity, target?}}} map. */
const profile = (id, description, sections) => ({
    id,
    schemaVersion: 1,
    description,
    sections: Object.fromEntries(Object.entries(sections).map(([sid, rules]) => [sid, {
        id: sid,
        enabled: true,
        rules: Object.fromEntries(Object.entries(rules).map(([rid, r]) => [rid, {
            id: rid, enabled: true, ...r,
        }])),
    }])),
});

const PDF_TYPES    = { mimeTypes: ['application/pdf'], extensions: ['pdf'] };
const RASTER_TYPES = {
    mimeTypes: ['image/jpeg', 'image/png', 'image/tiff'],
    extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff'],
};

const accept = (kind, prof, maxSize = 100000000) => ({
    kind,
    ...(kind === 'pdf' ? PDF_TYPES : RASTER_TYPES),
    maxSize,
    convertToPdf: false,
    preflight: { enabled: true, profile: prof },
    onFail: 'reject',
});

/** The transient inline workflow every demo product ships. */
const workflow = (title, ruleDescription, accepts, uiTitle) => ({
    schemaVersion: 1,
    title,
    trigger: 'order_placed',
    intake: { ruleId: null, onError: 'halt', enabled: true },
    streams: [],
    merge: { mode: 'none', config: {}, onError: 'halt', enabled: true },
    finalize: [],
    proofing: { enabled: false, type: 'basic', timing: 'after_intake', requireApproval: false, config: {} },
    delivery: { enabled: false, destinationIds: [] },
    enabled: true,
    ui: {},
    rule: {
        description: ruleDescription,
        cardinality: { min: 1, max: 1, slots: [] },
        accepts,
        rejectUnknownTypes: true,
        enabled: true,
        ui: { title: uiTitle },
    },
});

/** The file field. `workflowId` placeholder keeps pre-inline parsers happy. */
const fileField = (id, label, helpText, acceptMimes, wf) => ({
    id,
    type: 'file',
    display: 'dropzone',
    label,
    helpText,
    required: true,
    accept: acceptMimes,
    providerId: 'filecheck',
    filecheck: { workflowId: 'wf_inline_demo', workflow: wf },
});

const qtyTiers = (rows) => ({ basis: 'quantity', mode: 'flat', rows });
const areaTiers = (rows) => ({ basis: 'area', mode: 'flat', rows });
const summarySection = { id: 'summary', title: 'Summary', fields: [{ id: 'recap', type: 'info', display: 'summary' }] };

const blueprint = (productId, title, pricing, sections, layout = 'stacked') => ({
    version: '2.0', productId, title, layout, pricing, sections,
});

/* ── the products ─────────────────────────────────────────────────────── */

const products = {};

/* business-cards, checked, never priced from. Tiers + finish uplifts. */
{
    const prof = profile('prof_demo_cards', 'Business card checks', {
        geometry: {
            'geom.page_size':     { severity: 'reject', target: { allowed: [{ width_mm: 85, height_mm: 55 }], tolerance_mm: 1, autofix_within_percent: 0 } },
            'geom.page_count':    { severity: 'reject', target: { min: 1, max: 1, allowed: [] } },
            'geom.bleed.required': { severity: 'warn', target: { required_mm: 3, tolerance_mm: 1, sides: ['all'], fill: 'none' } },
            'geom.safety_margin': { severity: 'warn', target: { min_mm: 3 } },
        },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 300, target_width_mm: 85, target_height_mm: 55 } } },
        text: {
            'text.fonts_embedded':   { severity: 'warn' },
            'text.min_font_size_pt': { severity: 'warn', target: { pt: 5 } },
        },
    });
    products['demo-business-cards'] = blueprint('demo-business-cards', 'Business cards',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'print', title: 'Your cards', fields: [{
                    id: 'sides', type: 'select-one', display: 'pills', label: 'Sides', required: true,
                    options: [
                        { id: 'single', label: 'Single-sided', default: true, priceModifiers: [],
                          filecheck: { context: { pageCount: { min: 1, max: 1 } } } },
                        { id: 'double', label: 'Double-sided', description: 'Upload a 2-page file, front, then back.',
                          priceModifiers: [{ type: 'multiplier', amount: 1.4 }],
                          filecheck: { context: { pageCount: { min: 2, max: 2 } } } },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your card design',
                    'Standard 85 × 55 mm cards. We check size, bleed, safe zone, resolution and that your fonts are embedded.',
                    ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'],
                    workflow('Business cards demo', 'Business card checks, the everyday baseline.',
                        [accept('pdf', prof), accept('raster', prof)], 'Upload your card design'),
                )],
            },
            {
                id: 'finishing', title: 'Paper & finish', fields: [
                    {
                        id: 'paper', type: 'select-one', display: 'pills', label: 'Paper', role: 'material', required: true,
                        options: [
                            { id: 'std-350', label: '350 gsm silk', default: true, priceModifiers: [] },
                            { id: 'premium-450', label: '450 gsm premium', priceModifiers: [{ type: 'multiplier', amount: 1.15 }] },
                        ],
                    },
                    {
                        id: 'lamination', type: 'select-one', display: 'pills', label: 'Lamination', required: true,
                        options: [
                            { id: 'none', label: 'None', default: true, priceModifiers: [] },
                            { id: 'matte', label: 'Matte laminate', priceModifiers: [{ type: 'percent', amount: 15 }] },
                            { id: 'soft-touch', label: 'Soft touch', priceModifiers: [{ type: 'percent', amount: 25 }] },
                        ],
                    },
                    {
                        id: 'corners', type: 'select-one', display: 'pills', label: 'Corners', required: true,
                        options: [
                            { id: 'square', label: 'Square', default: true, priceModifiers: [] },
                            { id: 'rounded', label: 'Rounded', description: 'One-off die charge.',
                              priceModifiers: [{ type: 'fixed', amount: 10 }] },
                        ],
                    },
                ],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'copies', type: 'quantity', display: 'pills', label: 'How many?',
                    min: 50, defaultValue: 100, presets: [100, 250, 500, 1000],
                    priceModifiers: [{
                        type: 'perUnit', amount: 0.12,
                        tiers: qtyTiers([
                            { upTo: 249, amount: 0.12 }, { upTo: 499, amount: 0.08 },
                            { upTo: 999, amount: 0.055 }, { amount: 0.04 },
                        ]),
                    }],
                }],
            },
            summarySection,
        ]);
}

/* folded-leaflet; fold sets the safe zone; two spreads, always. */
{
    const prof = profile('prof_demo_leaflet', 'Folded leaflet checks', {
        geometry: {
            'geom.page_size':     { severity: 'reject', target: { allowed: [{ width_mm: 297, height_mm: 210 }], tolerance_mm: 2, autofix_within_percent: 0 } },
            'geom.page_count':    { severity: 'reject', target: { min: 2, max: 2, allowed: [] } },
            'geom.orientation':   { severity: 'warn', target: { allowed: 'landscape' } },
            'geom.bleed.required': { severity: 'warn', target: { required_mm: 3, tolerance_mm: 1, sides: ['all'], fill: 'none' } },
            'geom.safety_margin': { severity: 'warn', target: { min_mm: 5 } },
        },
        text: { 'text.fonts_embedded': { severity: 'warn' } },
    });
    products['demo-folded-leaflet'] = blueprint('demo-folded-leaflet', 'Folded leaflet',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'fold', title: 'Fold', fields: [{
                    id: 'fold', type: 'select-one', display: 'cards', label: 'Fold style', required: true,
                    options: [
                        { id: 'half', label: 'Half fold', description: 'A4 folded once to A5.', default: true,
                          priceModifiers: [], filecheck: { context: { safety: { min_mm: 5 } } } },
                        { id: 'tri', label: 'Tri fold', description: 'Folded twice to DL; keep text clear of the folds.',
                          priceModifiers: [{ type: 'fixed', amount: 12 }],
                          filecheck: { context: { safety: { min_mm: 8 } } } },
                        { id: 'z', label: 'Z fold', description: 'Accordion fold to DL.',
                          priceModifiers: [{ type: 'fixed', amount: 12 }],
                          filecheck: { context: { safety: { min_mm: 8 } } } },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your leaflet (2 pages)',
                    'One landscape A4 page per side: outer spread first, inner spread second. The fold you picked sets how much clearance your text needs.',
                    ['application/pdf'],
                    workflow('Folded leaflet demo', 'Leaflet checks; fold sets the safe zone.',
                        [accept('pdf', prof)], 'Upload your leaflet artwork'),
                )],
            },
            {
                id: 'paper', title: 'Paper & quantity', fields: [
                    {
                        id: 'paper', type: 'select-one', display: 'pills', label: 'Paper', role: 'material', required: true,
                        options: [
                            { id: 'silk-130', label: '130 gsm silk', default: true, priceModifiers: [] },
                            { id: 'silk-170', label: '170 gsm silk', priceModifiers: [{ type: 'percent', amount: 10 }] },
                        ],
                    },
                    {
                        id: 'copies', type: 'quantity', display: 'pills', label: 'How many?',
                        min: 50, defaultValue: 100, presets: [100, 250, 500, 1000],
                        priceModifiers: [{
                            type: 'perUnit', amount: 0.32,
                            tiers: qtyTiers([
                                { upTo: 249, amount: 0.32 }, { upTo: 999, amount: 0.22 }, { amount: 0.16 },
                            ]),
                        }],
                    },
                ],
            },
            summarySection,
        ]);
}

/* stickers-diecut; the upload IS the specification: priced from canvas. */
{
    const prof = profile('prof_demo_stickers', 'Die-cut sticker checks', {
        geometry: { 'geom.bleed.required': { severity: 'warn', target: { required_mm: 1, tolerance_mm: 0.5, sides: ['all'], fill: 'none' } } },
        raster: {
            'raster.effective_dpi':      { severity: 'warn', target: { min_dpi: 300 } },
            'raster.background_removal': { severity: 'warn' },
        },
    });
    products['demo-stickers-diecut'] = blueprint('demo-stickers-diecut', 'Die-cut stickers',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' }, minimumPrice: 20 },
        [
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [
                    fileField('artwork', 'Upload your sticker artwork',
                        'The sticker is priced from your artwork’s own trim size, no dimensions to type. Transparent backgrounds cut best.',
                        ['application/pdf', 'image/png', 'image/tiff'],
                        workflow('Die-cut stickers demo', 'Sticker checks; the canvas the file reports drives the area price.',
                            [accept('pdf', prof), accept('raster', prof)], 'Upload your sticker artwork')),
                    {
                        id: 'size-readout', type: 'info', display: 'summary', label: 'Detected size',
                        visibleWhen: { all: [{ ref: 'file.status', op: 'eq', value: 'ready' }] },
                    },
                ],
            },
            {
                id: 'material', title: 'Material & cut', fields: [
                    {
                        id: 'material', type: 'select-one', display: 'list', label: 'Material', role: 'material', required: true,
                        options: [
                            { id: 'white-vinyl', label: 'White vinyl', default: true,
                              priceModifiers: [{ type: 'perArea', amount: 120, areaUnit: 'sqm',
                                  tiers: qtyTiers([{ upTo: 99, amount: 120 }, { upTo: 499, amount: 90 }, { amount: 70 }]) }] },
                            { id: 'clear-vinyl', label: 'Clear vinyl',
                              priceModifiers: [{ type: 'perArea', amount: 140, areaUnit: 'sqm',
                                  tiers: qtyTiers([{ upTo: 99, amount: 140 }, { upTo: 499, amount: 105 }, { amount: 80 }]) }] },
                            { id: 'holographic', label: 'Holographic',
                              priceModifiers: [{ type: 'perArea', amount: 180, areaUnit: 'sqm',
                                  tiers: qtyTiers([{ upTo: 99, amount: 180 }, { upTo: 499, amount: 140 }, { amount: 110 }]) }] },
                        ],
                    },
                    {
                        id: 'cut', type: 'select-one', display: 'pills', label: 'Cut', required: true,
                        options: [
                            { id: 'kiss', label: 'Kiss cut', default: true, priceModifiers: [] },
                            { id: 'die', label: 'Die cut', description: 'Cut through the backing, one-off die charge.',
                              priceModifiers: [{ type: 'fixed', amount: 15 }] },
                        ],
                    },
                ],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'qty', type: 'quantity', display: 'stepper', label: 'How many stickers?',
                    min: 10, defaultValue: 50,
                }],
            },
            summarySection,
        ]);
}

/* booklet-saddle; wizard; picked pagination enforced, priced from real pages. */
{
    const prof = profile('prof_demo_booklet', 'Saddle-stitch booklet checks', {
        geometry: {
            'geom.page_size':             { severity: 'warn', target: { allowed: [{ width_mm: 148, height_mm: 210 }], tolerance_mm: 2, autofix_within_percent: 0 } },
            'geom.page_count':            { severity: 'reject', target: { min: 8, max: 48, allowed: [] } },
            'geom.consistent_page_sizes': { severity: 'reject' },
            'geom.spread_vs_single':      { severity: 'warn', target: { mode: 'single' } },
        },
        text: { 'text.fonts_embedded': { severity: 'warn' } },
    });
    products['demo-booklet-saddle'] = blueprint('demo-booklet-saddle', 'Saddle-stitched booklet',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' }, setupFee: 15 },
        [
            {
                id: 'spec', title: 'Format', fields: [
                    {
                        id: 'size', type: 'select-one', display: 'pills', label: 'Size', role: 'size', required: true,
                        options: [
                            { id: 'a5', label: 'A5', default: true, priceModifiers: [],
                              filecheck: { context: { artworkSize: { width_mm: 148, height_mm: 210 } } } },
                            { id: 'a4', label: 'A4', priceModifiers: [{ type: 'multiplier', amount: 1.35 }],
                              filecheck: { context: { artworkSize: { width_mm: 210, height_mm: 297 } } } },
                        ],
                    },
                    {
                        id: 'pages', type: 'select-one', display: 'pills', label: 'Page count', role: 'pages', required: true,
                        helpText: 'Saddle stitch needs a multiple of four. Your file must match the count you pick.',
                        options: [
                            { id: '8', label: '8 pages', default: true, priceModifiers: [] },
                            { id: '12', label: '12 pages', priceModifiers: [] },
                            { id: '16', label: '16 pages', priceModifiers: [] },
                            { id: '20', label: '20 pages', priceModifiers: [] },
                        ],
                    },
                ],
            },
            {
                id: 'artwork', title: 'Your document - Filecheck', fields: [fileField(
                    'document', 'Upload your booklet (single pages, in order)',
                    'Export as single pages, not reader’s spreads. The inner-stock price is computed from the pages we actually find in your file.',
                    ['application/pdf'],
                    workflow('Saddle booklet demo', 'Booklet checks; the picked pagination is enforced against the file.',
                        [accept('pdf', prof)], 'Upload your booklet'),
                )],
            },
            {
                id: 'stocks', title: 'Cover & inner stock', fields: [
                    {
                        id: 'cover', type: 'select-one', display: 'pills', label: 'Cover', required: true,
                        options: [
                            { id: 'gloss-250', label: '250 gsm gloss', default: true, priceModifiers: [] },
                            { id: 'matte-300', label: '300 gsm matte', priceModifiers: [{ type: 'fixed', amount: 8 }] },
                        ],
                    },
                    {
                        id: 'inner', type: 'select-one', display: 'pills', label: 'Inner pages', required: true,
                        options: [
                            { id: 'silk-115', label: '115 gsm silk', default: true,
                              priceModifiers: [{ type: 'perPage', amount: 0.03 }] },
                            { id: 'silk-130', label: '130 gsm silk',
                              priceModifiers: [{ type: 'perPage', amount: 0.04 }] },
                        ],
                    },
                ],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'qty', type: 'quantity', display: 'pills', label: 'How many booklets?',
                    min: 25, defaultValue: 50, presets: [25, 50, 100, 250],
                    priceModifiers: [{
                        type: 'perUnit', amount: 1.1,
                        tiers: qtyTiers([{ upTo: 99, amount: 1.1 }, { upTo: 249, amount: 0.85 }, { amount: 0.65 }]),
                    }],
                }],
            },
            summarySection,
        ], 'wizard');
}

/* banner-typed-size; configurator port of the classic banner demo. */
{
    const prof = profile('prof_demo_banner_typed', 'Banner checks; size and finish from the page', {
        geometry: {
            'geom.page_size':     { severity: 'reject', target: { allowed: [{ width_mm: 3000, height_mm: 1000 }], tolerance_mm: 2, autofix_within_percent: 0 } },
            'geom.bleed.required': { severity: 'warn', target: { required_mm: 25, tolerance_mm: 1, sides: ['all'], fill: 'none' } },
        },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 72, target_width_mm: 3000, target_height_mm: 1000 } } },
    });
    products['demo-banner-typed-size'] = blueprint('demo-banner-typed-size', 'PVC banner',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' }, setupFee: 6, minimumPrice: 25 },
        [
            {
                id: 'size', title: 'Size', fields: [{
                    id: 'size', type: 'dimensions', display: 'inputs', label: 'Finished size', required: true,
                    units: ['mm', 'cm', 'in'], defaultUnit: 'cm',
                    minW: 20, maxW: 1000, minH: 20, maxH: 300,
                    defaultValue: { w: 300, h: 100 },
                }],
            },
            {
                id: 'finishing', title: 'Finishing', fields: [{
                    id: 'finishing', type: 'select-one', display: 'list', label: 'Finishing', required: true,
                    options: [
                        { id: 'hem-eyelets', label: 'Hem and eyelets', description: 'Needs 25 mm bleed.', default: true,
                          priceModifiers: [{ type: 'fixed', amount: 8 }],
                          filecheck: { context: { bleed: { required_mm: 25 }, safety: { min_mm: 20 } } } },
                        { id: 'hem', label: 'Hem only', description: 'Needs 15 mm bleed.',
                          priceModifiers: [{ type: 'fixed', amount: 4 }],
                          filecheck: { context: { bleed: { required_mm: 15 }, safety: { min_mm: 15 } } } },
                        { id: 'trimmed', label: 'Trimmed to size', description: 'Needs 3 mm bleed.',
                          priceModifiers: [],
                          filecheck: { context: { bleed: { required_mm: 3 }, safety: { min_mm: 5 } } } },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your banner artwork',
                    'Checked against the exact size you typed and the bleed your finishing needs. Change either and the check re-runs.',
                    ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'],
                    workflow('Banner demo; typed size', 'Banner checks; size and finish come from the page.',
                        [accept('pdf', prof), accept('raster', prof)], 'Upload your banner artwork'),
                )],
            },
            {
                id: 'material', title: 'Material & quantity', fields: [
                    {
                        id: 'material', type: 'select-one', display: 'list', label: 'Material', role: 'material', required: true,
                        options: [
                            { id: 'pvc-450', label: '450 gsm PVC (indoor)', default: true,
                              priceModifiers: [{ type: 'perArea', amount: 18, areaUnit: 'sqm', dimensionsField: 'size',
                                  tiers: areaTiers([{ upTo: 5, amount: 18 }, { upTo: 20, amount: 14.5 }, { amount: 11 }]) }] },
                            { id: 'pvc-650', label: '650 gsm PVC (outdoor, reinforced)',
                              priceModifiers: [{ type: 'perArea', amount: 24, areaUnit: 'sqm', dimensionsField: 'size',
                                  tiers: areaTiers([{ upTo: 5, amount: 24 }, { upTo: 20, amount: 19.5 }, { amount: 15 }]) }] },
                        ],
                    },
                    { id: 'qty', type: 'quantity', display: 'stepper', label: 'How many banners?', min: 1, defaultValue: 1 },
                ],
            },
            summarySection,
        ]);
}

/* banner-auto-size; no size inputs at all; the canvas is the specification. */
{
    const prof = profile('prof_demo_banner_auto', 'Banner checks; any size, priced from the artwork', {
        geometry: { 'geom.bleed.required': { severity: 'warn', target: { required_mm: 25, tolerance_mm: 1, sides: ['all'], fill: 'none' } } },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 72 } } },
    });
    products['demo-banner-auto-size'] = blueprint('demo-banner-auto-size', 'Banner, priced from your artwork',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' }, setupFee: 6, minimumPrice: 25 },
        [
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [
                    fileField('artwork', 'Upload your banner artwork',
                        'No size inputs on this page; the banner is priced from your artwork’s own trim size.',
                        ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'],
                        workflow('Banner demo; auto size', 'Banner checks; the upload decides the size and the price.',
                            [accept('pdf', prof), accept('raster', prof)], 'Upload your banner artwork')),
                    {
                        id: 'size-readout', type: 'info', display: 'summary', label: 'Detected size',
                        visibleWhen: { all: [{ ref: 'file.status', op: 'eq', value: 'ready' }] },
                    },
                ],
            },
            {
                id: 'material', title: 'Material & finishing', fields: [
                    {
                        id: 'material', type: 'select-one', display: 'list', label: 'Material', role: 'material', required: true,
                        options: [
                            { id: 'pvc-450', label: '450 gsm PVC (indoor)', default: true, sku: 'PVC450',
                              priceModifiers: [{ type: 'perArea', amount: 18, areaUnit: 'sqm',
                                  tiers: areaTiers([{ upTo: 5, amount: 18 }, { upTo: 20, amount: 14.5 }, { amount: 11 }]) }] },
                            { id: 'pvc-650', label: '650 gsm PVC (outdoor, reinforced)', sku: 'PVC650',
                              priceModifiers: [{ type: 'perArea', amount: 24, areaUnit: 'sqm',
                                  tiers: areaTiers([{ upTo: 5, amount: 24 }, { upTo: 20, amount: 19.5 }, { amount: 15 }]) }] },
                        ],
                    },
                    {
                        id: 'finishing', type: 'select-many', display: 'list', label: 'Finishing', minSelect: 0,
                        options: [
                            { id: 'hem', label: 'Hemmed edges', priceModifiers: [{ type: 'perArea', amount: 2, areaUnit: 'sqm' }] },
                            { id: 'eyelets', label: 'Eyelets every 50 cm', priceModifiers: [{ type: 'fixed', amount: 8 }] },
                            { id: 'pole-pockets', label: 'Pole pockets', priceModifiers: [{ type: 'fixed', amount: 12 }] },
                        ],
                    },
                ],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'qty', type: 'quantity', display: 'stepper', label: 'How many banners?', min: 1, defaultValue: 1,
                }],
            },
            summarySection,
        ]);
}

/* poster-classic; typed size prices; the file is validated at that size only. */
{
    const prof = profile('prof_demo_poster', 'Poster checks. DPI at the chosen print size', {
        geometry: {
            'geom.page_size':     { severity: 'warn', target: { allowed: [{ width_mm: 500, height_mm: 700 }], tolerance_mm: 2, autofix_within_percent: 0 } },
            'geom.bleed.required': { severity: 'warn', target: { required_mm: 5, tolerance_mm: 1, sides: ['all'], fill: 'none' } },
        },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 150, target_width_mm: 500, target_height_mm: 700 } } },
    });
    products['demo-poster-classic'] = blueprint('demo-poster-classic', 'Custom size poster',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' }, minimumPrice: 12 },
        [
            {
                id: 'size', title: 'Size', fields: [{
                    id: 'dimensions', type: 'dimensions', display: 'inputs', label: 'Poster size',
                    helpText: 'The price comes from this size; the file only has to look good at it.',
                    required: true, units: ['mm', 'cm', 'in'], defaultUnit: 'cm',
                    minW: 10, maxW: 150, minH: 10, maxH: 300,
                    defaultValue: { w: 50, h: 70 },
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your poster artwork',
                    'Resolution is judged at the size you chose above. Grow the poster and the same file may stop being sharp enough.',
                    ['application/pdf', 'image/jpeg', 'image/png'],
                    workflow('Poster demo', 'Poster checks; resolution at the chosen size; price never comes from the file.',
                        [accept('pdf', prof), accept('raster', prof)], 'Upload your poster artwork'),
                )],
            },
            {
                id: 'paper', title: 'Paper & quantity', fields: [
                    {
                        id: 'stock', type: 'select-one', display: 'pills', label: 'Paper', role: 'material', required: true,
                        options: [
                            { id: 'matt-170', label: '170 gsm matt', default: true, sku: 'M170',
                              priceModifiers: [{ type: 'perArea', amount: 28, areaUnit: 'sqm', dimensionsField: 'dimensions' }] },
                            { id: 'satin-250', label: '250 gsm satin', sku: 'S250',
                              priceModifiers: [{ type: 'perArea', amount: 39, areaUnit: 'sqm', dimensionsField: 'dimensions' }] },
                        ],
                    },
                    {
                        id: 'qty', type: 'quantity', display: 'pills', label: 'How many posters?',
                        min: 1, defaultValue: 1, presets: [1, 2, 5, 10, 25],
                    },
                ],
            },
            summarySection,
        ]);
}

/* rollup-stand; fixed-size product; the cassette eats the bottom 150 mm. */
{
    const prof = profile('prof_demo_rollup', 'Roll-up checks; exact template, tail included', {
        geometry: {
            'geom.page_size':     { severity: 'reject', target: { allowed: [{ width_mm: 850, height_mm: 2150 }], tolerance_mm: 2, autofix_within_percent: 0 } },
            'geom.safety_margin': { severity: 'warn', target: { min_mm: 30 } },
        },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 100, target_width_mm: 850, target_height_mm: 2150 } } },
    });
    products['demo-rollup-stand'] = blueprint('demo-rollup-stand', 'Roll-up banner stand',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'stand', title: 'Stand', fields: [{
                    id: 'stand', type: 'select-one', display: 'cards', label: 'Hardware', required: true,
                    options: [
                        { id: 'standard', label: 'Standard stand', description: 'Aluminium cassette, carry bag not included.',
                          default: true, priceModifiers: [{ type: 'perUnit', amount: 45 }] },
                        { id: 'premium', label: 'Premium stand', description: 'Wide base, swappable cassette.',
                          priceModifiers: [{ type: 'perUnit', amount: 65 }] },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your roll-up artwork (850 × 2150 mm)',
                    'The visible area is 850 × 2000 mm; the bottom 150 mm disappears into the cassette, so your file must be 850 × 2150 mm with nothing important in the tail.',
                    ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'],
                    workflow('Roll-up stand demo', 'Roll-up checks; a fixed template with a cassette tail.',
                        [accept('pdf', prof), accept('raster', prof)], 'Upload your roll-up artwork'),
                )],
            },
            {
                id: 'extras', title: 'Extras & quantity', fields: [
                    {
                        id: 'bag', type: 'select-one', display: 'pills', label: 'Carry bag', required: true,
                        options: [
                            { id: 'none', label: 'No bag', default: true, priceModifiers: [] },
                            { id: 'bag', label: 'Padded carry bag', priceModifiers: [{ type: 'perUnit', amount: 6 }] },
                        ],
                    },
                    { id: 'qty', type: 'quantity', display: 'stepper', label: 'How many stands?', min: 1, defaultValue: 1 },
                ],
            },
            summarySection,
        ]);
}

/* tshirt-dtg; raster-first: background, resolution at garment print size. */
{
    const prof = profile('prof_demo_tshirt', 'T-shirt print checks; raster artwork at garment size', {
        raster: {
            'raster.effective_dpi':      { severity: 'warn', target: { min_dpi: 150, target_width_mm: 210, target_height_mm: 297 } },
            'raster.background_removal': { severity: 'warn' },
            'raster.min_dimensions_px':  { severity: 'warn', target: { min_width: 1000, min_height: 1000 } },
        },
    });
    products['demo-tshirt-dtg'] = blueprint('demo-tshirt-dtg', 'Printed t-shirt',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'garment', title: 'Your shirt', fields: [
                    {
                        id: 'gsize', type: 'select-one', display: 'pills', label: 'Size', required: true,
                        options: [
                            { id: 's', label: 'S', priceModifiers: [] },
                            { id: 'm', label: 'M', default: true, priceModifiers: [] },
                            { id: 'l', label: 'L', priceModifiers: [] },
                            { id: 'xl', label: 'XL', priceModifiers: [] },
                            { id: 'xxl', label: 'XXL', priceModifiers: [] },
                        ],
                    },
                    {
                        id: 'colour', type: 'select-one', display: 'swatches', label: 'Colour', required: true,
                        options: [
                            { id: 'white', label: 'White', color: '#f5f5f2', default: true, priceModifiers: [] },
                            { id: 'black', label: 'Black', color: '#16161a', description: 'Dark garments need a white underbase.',
                              priceModifiers: [{ type: 'perUnit', amount: 2 }] },
                            { id: 'navy', label: 'Navy', color: '#223a5e', description: 'Dark garments need a white underbase.',
                              priceModifiers: [{ type: 'perUnit', amount: 2 }] },
                        ],
                    },
                ],
            },
            {
                id: 'print', title: 'Print', fields: [{
                    id: 'printsize', type: 'select-one', display: 'pills', label: 'Print area', required: true,
                    options: [
                        { id: 'a4', label: 'A4 chest print', default: true, priceModifiers: [],
                          filecheck: { context: { artworkSize: { width_mm: 210, height_mm: 297 } } } },
                        { id: 'a3', label: 'A3 full front', priceModifiers: [{ type: 'perUnit', amount: 4 }],
                          filecheck: { context: { artworkSize: { width_mm: 297, height_mm: 420 } } } },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your design - Filecheck', fields: [fileField(
                    'artwork', 'Upload your design (PNG with transparency works best)',
                    'A flat white background will print as a white box on the shirt; we warn you before it does. Resolution is judged at the print area you picked.',
                    ['image/png', 'image/jpeg', 'image/tiff'],
                    workflow('T-shirt demo', 'Shirt print checks; background and resolution at garment size.',
                        [accept('raster', prof)], 'Upload your design'),
                )],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'qty', type: 'quantity', display: 'pills', label: 'How many shirts?',
                    min: 1, defaultValue: 10, presets: [10, 25, 50, 100],
                    priceModifiers: [{
                        type: 'perUnit', amount: 12,
                        tiers: qtyTiers([{ upTo: 24, amount: 12 }, { upTo: 99, amount: 9.5 }, { amount: 7.5 }]),
                    }],
                }],
            },
            summarySection,
        ]);
}

/* mug-wrap; a physical template: picking the bigger mug changes what fits. */
{
    const prof = profile('prof_demo_mug', 'Mug wrap checks; template and handle keep-out', {
        geometry: {
            'geom.page_size':     { severity: 'reject', target: { allowed: [{ width_mm: 200, height_mm: 85 }], tolerance_mm: 1, autofix_within_percent: 0 } },
            'geom.safety_margin': { severity: 'warn', target: { min_mm: 10 } },
        },
        raster: {
            'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 300, target_width_mm: 200, target_height_mm: 85 } },
            'raster.aspect_ratio':  { severity: 'warn', target: { ratio: [40, 17], tolerance: 0.05 } },
        },
    });
    products['demo-mug-wrap'] = blueprint('demo-mug-wrap', 'Wrap-print mug',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'mug', title: 'Your mug', fields: [{
                    id: 'mug', type: 'select-one', display: 'cards', label: 'Mug', required: true,
                    options: [
                        { id: 'oz11', label: '11 oz classic', description: 'Wrap template 200 × 85 mm.', default: true,
                          priceModifiers: [{ type: 'perUnit', amount: 8.5,
                              tiers: qtyTiers([{ upTo: 23, amount: 8.5 }, { upTo: 99, amount: 6.5 }, { amount: 5 }]) }],
                          filecheck: { context: { artworkSize: { width_mm: 200, height_mm: 85 } } } },
                        { id: 'oz15', label: '15 oz tall', description: 'Wrap template 210 × 100 mm.',
                          priceModifiers: [{ type: 'perUnit', amount: 9.5,
                              tiers: qtyTiers([{ upTo: 23, amount: 9.5 }, { upTo: 99, amount: 7.5 }, { amount: 6 }]) }],
                          filecheck: { context: { artworkSize: { width_mm: 210, height_mm: 100 } } } },
                    ],
                }],
            },
            {
                id: 'artwork', title: 'Your artwork - Filecheck', fields: [fileField(
                    'artwork', 'Upload your wrap artwork',
                    'The artwork must match the wrap template of the mug you picked; switch mugs and the same file is re-checked against the new template. Keep 10 mm clear of each end for the handle.',
                    ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'],
                    workflow('Mug wrap demo', 'Mug checks; the template follows the selected mug.',
                        [accept('pdf', prof), accept('raster', prof)], 'Upload your wrap artwork'),
                )],
            },
            {
                id: 'extras', title: 'Extras & quantity', fields: [
                    {
                        id: 'giftbox', type: 'select-one', display: 'pills', label: 'Gift box', required: true,
                        options: [
                            { id: 'none', label: 'None', default: true, priceModifiers: [] },
                            { id: 'box', label: 'Gift box', priceModifiers: [{ type: 'perUnit', amount: 1.5 }] },
                        ],
                    },
                    {
                        id: 'qty', type: 'quantity', display: 'pills', label: 'How many mugs?',
                        min: 1, defaultValue: 6, presets: [6, 12, 24, 48],
                    },
                ],
            },
            summarySection,
        ]);
}

/* canvas-print; consumer photo product: DPI vs frame, wrap needs real bleed. */
{
    const pdfProf = profile('prof_demo_canvas_pdf', 'Canvas checks; size and wrap bleed', {
        geometry: {
            'geom.page_size':     { severity: 'warn', target: { allowed: [{ width_mm: 300, height_mm: 400 }], tolerance_mm: 10, autofix_within_percent: 0 } },
            'geom.bleed.required': { severity: 'warn', target: { required_mm: 38, tolerance_mm: 2, sides: ['all'], fill: 'none' } },
        },
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 100, target_width_mm: 300, target_height_mm: 400 } } },
    });
    const rasterProf = profile('prof_demo_canvas_raster', 'Canvas checks; resolution at frame size', {
        raster: { 'raster.effective_dpi': { severity: 'warn', target: { min_dpi: 100, target_width_mm: 300, target_height_mm: 400 } } },
    });
    products['demo-canvas-print'] = blueprint('demo-canvas-print', 'Photo canvas',
        { currency: 'USD', basePrice: { amount: 0, per: 'order' } },
        [
            {
                id: 'frame', title: 'Your canvas', fields: [
                    {
                        id: 'frame', type: 'select-one', display: 'cards', label: 'Size', role: 'size', required: true,
                        options: [
                            { id: 'f3040', label: '30 × 40 cm', default: true,
                              priceModifiers: [{ type: 'perUnit', amount: 29 }],
                              filecheck: { context: { artworkSize: { width_mm: 300, height_mm: 400 } } } },
                            { id: 'f5070', label: '50 × 70 cm',
                              priceModifiers: [{ type: 'perUnit', amount: 49 }],
                              filecheck: { context: { artworkSize: { width_mm: 500, height_mm: 700 } } } },
                            { id: 'f6090', label: '60 × 90 cm',
                              priceModifiers: [{ type: 'perUnit', amount: 69 }],
                              filecheck: { context: { artworkSize: { width_mm: 600, height_mm: 900 } } } },
                        ],
                    },
                    {
                        id: 'wrap', type: 'select-one', display: 'pills', label: 'Edge', required: true,
                        options: [
                            { id: 'gallery', label: 'Gallery wrap', description: 'The photo folds around the frame and needs 38 mm extra on every side.',
                              default: true, priceModifiers: [],
                              filecheck: { context: { bleed: { required_mm: 38 } } } },
                            { id: 'mirror', label: 'Mirror wrap', description: 'Edges are mirrored, no extra image needed.',
                              priceModifiers: [],
                              filecheck: { context: { bleed: { required_mm: 0 } } } },
                            { id: 'white', label: 'White edge', priceModifiers: [],
                              filecheck: { context: { bleed: { required_mm: 0 } } } },
                        ],
                    },
                ],
            },
            {
                id: 'artwork', title: 'Your photo - Filecheck', fields: [fileField(
                    'artwork', 'Upload your photo',
                    'Canvas is forgiving. 100 dpi at print size looks great. We check your photo against the frame size and edge style you picked.',
                    ['image/jpeg', 'image/png', 'application/pdf'],
                    workflow('Photo canvas demo', 'Canvas checks; resolution and wrap bleed follow the frame.',
                        [accept('pdf', pdfProf), accept('raster', rasterProf)], 'Upload your photo'),
                )],
            },
            {
                id: 'quantity', title: 'Quantity', fields: [{
                    id: 'qty', type: 'quantity', display: 'stepper', label: 'How many canvases?', min: 1, defaultValue: 1,
                }],
            },
            summarySection,
        ]);
}

/* ── emit ─────────────────────────────────────────────────────────────── */

for (const [id, doc] of Object.entries(products)) {
    writeFileSync(join(out, `${id}.json`), JSON.stringify(doc, null, 2) + '\n');
}
console.log(`wrote ${Object.keys(products).length} configs to public/configs/po/:`);
console.log('  ' + Object.keys(products).join('\n  '));
