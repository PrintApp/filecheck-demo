# Demo catalog. Filecheck × Print Options (draft outline)

Working spec for the expanded demo platform. 13 configurator-driven product
pages in 4 categories, plus the existing hand-wired pages kept as
"integration patterns". Status: **all 13 built and price-verified.** The two
pilots are hand-authored JSON; the other eleven are emitted by
`tools/make-po-configs.mjs` (edit the generator, not the emitted files).

Companion docs: `../README.md` (current demo setup),
`product-options/docs/blueprint-authoring/README.md` (blueprint rules),
`product-options/docs/page-api-v1.md` (widget contract).

---

## 1. The shape of the platform

### One template, one JSON per product

- **`shop.html?product=<slug>`**; a single product-page template (following
  the `client-sample.html` precedent). It reads `catalog.json`, renders the
  fake-shop chrome (brand, breadcrumb, gallery placeholder, hint box), and
  mounts `<print-configurator>` pointed at that product's config.
- **`public/configs/po/<slug>.json`**; one self-contained file per product:
  the Print Options blueprint **plus** the inline Filecheck workflow it
  carries (see §2). Adding a demo = one JSON + one catalog entry.
- **`public/catalog.json`**; single source of truth: slug, category, title,
  one-liner, "Shows:" line, capability tags, sample-file list, brand name.
  Drives both the landing-page cards and the shop template's chrome.
- **Existing hand-wired pages stay** (`pvc-banner.html`,
  `business-cards.html`, `freetool.html`, `report.html`) under an
  "Integration patterns" section, they remain the view-source/copy-paste
  reference, and the banner page keeps the two-way DOM sync demo that the
  configurator flow doesn't replicate in v1.
- All blueprints are **USD** (must match the verify-price store default) and
  every one gets a `manifest.json` entry with `expectedTotal`s so
  `check.mjs` proves the arithmetic before anything ships.

### Why the element carries the whole story

Filecheck intake runs *inside* the configurator's file field
(`providerId: "filecheck"`), preview-tagged inline workflows mean **any
pasted publishable key works with zero admin setup**, same property the
current demos have. Facts flow back as a FileRecord (`pages`,
`colorPages`/`monoPages`, `canvas`) and the pricing engine reprices live.
That round trip. *upload → inspect → price moves*, is the demo.

---

## 2. Platform changes required (option b)

The element already accepts an inline `workflow` object
(`IntakeElementOptions.workflow`, used by every current demo page). What's
missing is the pass-through and the selection→check bridge:

| # | Where | Change |
| --- | --- | --- |
| B1 | `@product-options/schema` | `FileField.filecheck` gains optional `workflow` (opaque object). When present, `workflowId` is not required. Blueprints are public data; an inline workflow is rules-only; no secrets, same as today's demo page source. |
| B2 | `core-ui/FilecheckUpload.vue` | Pass `workflow` and `preview` through to `fc.elements.create('intake', …)` (today it passes only `workflowId`). `preview` comes from the page-level `provider` config, where it already exists. |
| B3 | `@filecheck/element` | New public method `IntakeElement.setContext(ctx: IntakeContext)`; pushes a context object to the iframe over the same channel the DOM probe uses today (`probeNow` path), skipping selectors entirely. Small, additive. |
| B4 | `@product-options/schema` + `core-ui` | **Selection context bridge.** Options/fields gain an optional `filecheck.context` patch (mirror of the connector's `map` idea): e.g. the "Hem + eyelets" option carries `{ bleed: { required_mm: 25 } }`. Implicit bridges by role need no annotation: a `dimensions`/`size`-role field maps to `artworkSize` (unit-converted to mm); a `pages`-role field maps to `pageCount`. `FilecheckUpload` listens to configurator state changes, merges implicit + explicit patches, calls `intake.setContext()`. |
| B5 | demo package | `shop.html` template, `catalog.json`, 13 config JSONs, landing rework, expanded `make-samples.mjs` matrix. |

**Hard constraint to keep in mind:** `IntakeContext` is
`{ artworkSize, pageCount, fileCount, bleed, safety }`, those five things
are all a selection can change about a check at runtime. Anything else
(transparency, DPI floors, font rules, encryption…) is a *static* choice in
each product's inline profile. The catalog below is designed so every
context-driven behaviour uses only those five keys.

**Field placement:** the intake mounts inside the configurator wherever the
blueprint's `file` field sits; sections render in order, and the price
summary with add-to-cart is always last. Convention: keep the uploader high, Filecheck is the main show, and it must not hide below the fold. Products
priced from the file put the artwork section first or right after the one
option group that affects the check (thesis: after Printing); pure
options-driven products may push it later, but never below more than two
option groups.

Direction FC → PO (facts to price) needs **nothing new**, FileRecord
already carries it. Write-back into configurator inputs (e.g. "adopt the
artwork's size into the dimensions field") is deliberately **out of scope
for v1**; the hand-wired banner page keeps demonstrating two-way sync.

---

## 3. The catalog, 13 products

Format per product: what the shopper does · blueprint outline · inline
workflow (static rules) · context bridge (dynamic) · sample files · the
scripted "Try it" moment.

### Category: Stationery & marketing

#### 1. `business-cards`, Business cards (Milldale Press)
- **Story:** the everyday baseline. Artwork is checked, never priced from.
- **Blueprint:** base `per: "unit"` with quantity tiers (100/250/500/1000
  presets, flat mode); paper `select-one` (350 gsm default, 450 gsm
  `multiplier` ×1.15); lamination `select-one` (none / matte `percent` +15 /
  soft-touch `percent` +25); rounded corners option with `fixed` die charge;
  sides `select-one` (single/double, double `multiplier` ×1.4).
- **Workflow (static):** `geom.page_size` 85×55 mm ±1; `geom.bleed.required`
  3 mm; `geom.safety_margin` 3 mm; `raster.effective_dpi` min 300;
  `text.fonts_embedded`; `text.min_font_size_pt` warn < 5 pt.
- **Context bridge:** sides → `pageCount` (single `{min:1,max:1}`, double
  `{min:2,max:2}`).
- **Samples:** `card-good.pdf` (pass) · `card-nobleed.pdf` ·
  `card-tinytype.pdf` (4 pt legal line, warn).
- **Try it:** upload the good file single-sided, flip to double-sided, same file is now "missing the back".

#### 2. `flyer-sizes`, Flyers (Milldale Press)
- **Story:** the size the customer picks is the size the file is judged by.
- **Blueprint:** size `select-one` role `size`, cards display (A6 / A5 / DL /
  A4) each with its own `perUnit` amount + quantity tiers; paper gloss/silk;
  sides single/double `multiplier` ×1.6; quantity presets.
- **Workflow (static):** `geom.bleed.required` 3 mm; `raster.effective_dpi`
  min 300; `geom.orientation` follows size map.
- **Context bridge:** size option → `artworkSize` (A6 105×148 … A4 210×297);
  sides → `pageCount` 1 vs 2. **This is the flagship context demo.**
- **Samples:** `flyer-a5.pdf` (pass on A5) · shared `lowres.png`.
- **Try it:** upload the A5 file, then click the A4 card, the check
  re-runs and fails *without re-uploading*; the price updates too.

#### 3. `folded-leaflet`, Folded leaflet (Milldale Press)
- **Story:** folding is where customer files most often go wrong.
- **Blueprint:** fold `select-one` with images (half / tri / Z, tri and Z
  carry a small `fixed` folding charge); paper; quantity tiers; an `info`
  note (`visibleWhen` fold = tri) explaining panel order.
- **Workflow (static):** `geom.bleed.required` 3 mm; `geom.safety_margin`
  5 mm (fold creep); `geom.consistent_page_sizes`; `geom.orientation`
  landscape.
- **Context bridge:** fold → `artworkSize` (flat trim per fold style) +
  `pageCount` `{min:2,max:2}` (outer + inner spread).
- **Samples:** `leaflet-trifold.pdf` (pass) · `leaflet-onepage.pdf`
  (missing inner spread).
- **Try it:** the one-page upload passes nothing, the demo shows *why*
  (needs both sides), then the correct file passes.

#### 4. `stickers-diecut`. Die-cut stickers (Peel & Stick Co.)
- **Story:** priced from the artwork's own trim size, upload decides cost.
- **Blueprint:** file field first; material `select-one` (white vinyl /
  clear / holographic) each with `perArea` rates + area tiers;
  `minimumPrice` floor; cut style kiss/die (`fixed` die charge on die-cut);
  quantity stepper; recap summary.
- **Workflow (static):** raster-friendly rule (accepts PDF/PNG/TIFF);
  `raster.effective_dpi` min 300; `raster.transparency`, warn when a flat
  background is detected (background-removal nudge); `geom.bleed.required`
  1 mm cut margin.
- **Context bridge:** none; the *reverse* flow is the point: FileRecord
  `canvas` drives `perArea`.
- **Samples:** `sticker-transparent.png` (pass) · `sticker-whitebg.png`
  (warn) · shared `lowres.png`.
- **Try it:** upload two different-sized artworks and watch the price
  follow the trim size; no dimension inputs exist on the page.

### Category: Documents & books

#### 5. `thesis-per-page`. Thesis & document printing (Campus Copy)
- **Story:** **the flagship pricing demo**; the price is literally built
  from what Filecheck found inside the file.
- **Blueprint:** adapt the verified `thesis-per-page.json` sample: colour
  mode `select-one` (auto-detect → `perColorPage` + `perMonoPage` split /
  force-mono → flat `perPage`); binding `select-one` (thermal hidden via
  `visibleWhen file.pages > 400`, hardcover `fixed`); copies `quantity`;
  paper weight. Info note showing the detected split.
- **Workflow (static):** `geom.page_size` A4 ±2; `geom.consistent_page_sizes`;
  `text.fonts_embedded`; `struct.encryption_allowed` false, **locked PDFs
  rejected**, an everyday real-world failure; colour detection on.
- **Context bridge:** none needed.
- **Samples:** `thesis-48p-mixed.pdf` (12 colour / 36 mono) ·
  `thesis-locked.pdf` (encrypted, rejected).
- **Try it:** upload the 48-page file; watch the line items appear
  (12 colour pages × rate + 36 mono × rate); switch colour mode and the
  same file reprices.

#### 6. `booklet-saddle`, Saddle-stitched booklet (Campus Copy)
- **Story:** you pick the pagination; the file must honour it; the price
  uses the pages you actually uploaded.
- **Blueprint:** adapt `booklet-preflight-gated.json`: wizard layout; size
  `select-one` role `size` (A5/A4); pages `select-one` role `pages`
  (8/12/16/20); cover stock; inner stock `perPage`; quantity breaks on
  base; guidance note driven by `file.pages`.
- **Workflow (static):** `geom.page_count` multiple-of-4 semantics via the
  exact count from context; `geom.consistent_page_sizes`;
  `geom.spread_vs_single` (reader's spreads rejected, export as single
  pages); `text.min_font_size_pt`.
- **Context bridge:** size → `artworkSize`; pages selection →
  `pageCount` `{min:N,max:N}`.
- **Samples:** `booklet-16p.pdf` (pass) · `booklet-13p.pdf` (wrong count) ·
  `booklet-spreads.pdf` (exported as spreads).
- **Try it:** the 13-page file fails at "16 pages", and the blueprint's
  `file.pages` note explains what saddle-stitch needs.

### Category: Large format

#### 7. `banner-typed-size`. PVC banner, typed size (Acme Signs)
- **Story:** configurator port of the classic banner: type a size, pick a
  finish, both the price and the check follow.
- **Blueprint:** `dimensions` field role `size` (units mm/cm/m/in/ft,
  sensible min/max); material 450/650 gsm with `perArea` + area tiers
  (from `banner-from-canvas.json`); finishing `select-one` hem+eyelets /
  hem / trimmed (eyelets `fixed` add-on); `setupFee`; `minimumPrice`;
  quantity.
- **Workflow (static):** `raster.effective_dpi` min 72 at size; accepts
  PDF + raster.
- **Context bridge:** dimensions → `artworkSize` (implicit by role);
  finishing option patches → `bleed`/`safety` (25/20, 15/15, 3/5 mm), the exact map the hand-wired page uses today.
- **Samples:** `banner-3x1m.pdf` (pass at default) · shared `nobleed.pdf`.
- **Try it:** change the width after uploading, check re-runs, price
  moves, nothing re-uploaded.

#### 8. `banner-auto-size`. Banner priced from artwork (Acme Signs)
- **Story:** no size inputs anywhere. The upload *is* the specification.
- **Blueprint:** verified `banner-from-canvas.json` nearly as-is: file
  first, detected-size `info` (`visibleWhen file.status = ready`),
  material `perArea` tiers, finishing, `setupFee` 6, `minimumPrice` 25.
- **Workflow (static):** `geom.bleed.required` 25 mm (hem default);
  `raster.effective_dpi` min 72 at the file's own size; warn above 1600 mm
  roll width.
- **Context bridge:** none, pure canvas→`perArea`.
- **Samples:** `banner-3x1m.pdf` · `banner-8x3m.pdf` (tier break + roll
  warn).
- **Try it:** upload each banner in turn; watch the area tier change the
  rate (18 → 14.50/m²) in the line items.

#### 9. `poster-classic`, Poster (Acme Signs)
- **Story:** the inverse of #8; price comes from the *typed* size, and
  Filecheck only validates. Proves the two products stay in their lanes.
- **Blueprint:** verified `poster-dimensions-checked.json` base:
  `dimensions` field priced with **graduated** area tiers; paper photo
  gloss / matte `percent` uplift; quantity.
- **Workflow (static):** `geom.bleed.required` 5 mm;
  `raster.effective_dpi` min 150 at the chosen size;
  `image.min_resolution_dpi`.
- **Context bridge:** dimensions → `artworkSize` (so the DPI check targets
  the real print size).
- **Samples:** `poster-a1.pdf` (pass at A1) · shared `lowres.png` (fine at
  A4, fails at A1, resolution is relative).
- **Try it:** upload the low-res image at 30×40 cm (passes), then grow the
  poster to 60×90, same file now warns. DPI depends on print size; this
  page makes that visceral.

#### 10. `rollup-stand`. Roll-up banner stand (Acme Signs)
- **Story:** fixed-size product with hardware; and the cassette eats the
  bottom of the artwork.
- **Blueprint:** stand `select-one` (standard / premium base, different
  `basePrice` via option `fixed` amounts); print `perArea` at the fixed
  850×2150 mm; carry bag `fixed` add-on; quantity.
- **Workflow (static):** `geom.page_size` exactly 850×2150 (2000 visible +
  150 tail) ±2; `geom.safety_margin` 30 mm; a static note (rule copy) that
  the bottom 150 mm disappears into the cassette; `raster.effective_dpi`
  min 100.
- **Context bridge:** none, fixed product, static profile. (Included
  deliberately: not every product needs the bridge, and the demo says so.)
- **Samples:** `rollup-correct.pdf` (with tail) · `rollup-2000.pdf` (sized
  to the *visible* area; the classic mistake, rejected with a clear
  finding).
- **Try it:** upload the 2000 mm file; the finding explains the tail.

### Category: Apparel & merch

#### 11. `tshirt-dtg`, T-shirt print (Inkbird Apparel)
- **Story:** raster-first checking, transparency, background, resolution
  at garment print size.
- **Blueprint:** garment size `select-one` S–XXL (unpriced); colour
  `swatches` (white / black / navy; dark colours `fixed` +2 underbase);
  print size `select-one` (A4 chest / A3 full, `fixed` step); quantity
  tiers (per-unit base).
- **Workflow (static):** raster-only rule (PNG/TIFF/PDF);
  `raster.transparency`, flat background warns ("we'll print the white
  box too"); `raster.effective_dpi` min 150 at print size;
  `raster.min_dimensions_px` floor; `raster.max_file_size`.
- **Context bridge:** print size → `artworkSize` (A4/A3) so the DPI target
  tracks the chest vs full-front choice.
- **Samples:** `logo-transparent.png` (pass) · `logo-whitebg.png` (warn) ·
  shared `lowres.png`.
- **Try it:** upload the white-background logo, the warning explains what
  will actually print; swap for the transparent version, cart unlocks.

#### 12. `mug-wrap`, Wrap-print mug (Inkbird Apparel)
- **Story:** template products; the artwork must fit a physical wrap.
- **Blueprint:** mug `select-one` (11 oz / 15 oz) with `perUnit` prices +
  quantity tiers; gift box `fixed` add-on; quantity stepper.
- **Workflow (static):** `geom.page_size` per template ±1;
  `raster.aspect_ratio`; `geom.safety_margin` 10 mm (handle keep-out);
  `raster.effective_dpi` min 300.
- **Context bridge:** mug choice → `artworkSize` (11 oz 200×85 mm,
  15 oz 210×100 mm); picking the bigger mug changes the template the file
  must match.
- **Samples:** `mug-wrap-11oz.pdf` (pass) · `mug-square.png` (wrong aspect).
- **Try it:** upload the 11 oz wrap, then switch to 15 oz, template
  mismatch appears instantly.

#### 13. `canvas-print`, Photo canvas (Inkbird Apparel)
- **Story:** consumer photo product. DPI and aspect ratio against a chosen
  frame, and gallery wrap needs *serious* bleed.
- **Blueprint:** frame `select-one` cards (30×40 / 50×70 / 60×90 cm,
  `perUnit` prices); wrap style `select-one` (gallery wrap default /
  mirror wrap / white edge); quantity.
- **Workflow (static):** `image.min_resolution_dpi` ~100 (canvas is
  forgiving; the copy says so); `raster.aspect_ratio` warn on mismatch
  ("we'd crop 8% off the top").
- **Context bridge:** frame → `artworkSize`; wrap style → `bleed`
  (gallery 38 mm / mirror 0 / white edge 0), a second, very tangible
  finish→bleed story after the banner.
- **Samples:** `photo-3x4.jpg` (pass on 30×40) · `photo-pano.jpg` (aspect
  warn) · shared `lowres.png`.
- **Try it:** pick 60×90 with gallery wrap and upload the phone photo, two findings (resolution, missing wrap bleed) in plain language.

### Category: Tools & post-purchase (existing, unchanged)

- **Preflight checker** (`freetool.html`); list-mode intake + live report.
- **Order report** (`report.html`), read-only fetch-mode report.
- *(Optional 14th, Filecheck-only)* `photo-prints`, multi-file list intake
  (`fileCount`), per-file findings; blueprints take a single file field, so
  this stays a pattern page, not a configurator page.

---

## 4. Landing page IA

Order: hero → filter → categories → patterns → key panel.

1. **Hero**; current voice, one added sentence: "Prices on these pages are
   computed by Print Options from what Filecheck finds in your file."
2. **Capability filter**; one row of plain chips (no framework):
   `size` `bleed` `safe zone` `DPI` `page count` `colour split`
   `transparency` `fonts` `priced from file` `area pricing`
   `per-page pricing` `cart gating`. Clicking a chip dims non-matching
   cards (tags come from `catalog.json`). Nothing more elaborate.
3. **Category sections**; the five categories above, each a `demo-grid` of
   cards in the existing style: kicker, title, one-liner, "Shows:" line,
   capability chips, plus **sample-file quick links** directly on the card
   ("try with: good ✓ / no bleed ✗") so a visitor can grab the file before
   they even open the page.
4. **Integration patterns**, the hand-wired pages, reframed: "view source
   on these; the whole integration is on the page."
5. **Key panel**; unchanged behaviour; copy updated to note the combined
   demos also honour a pasted key (inline workflows, nothing to configure).

Per-product page chrome (`shop.html`): demo bar → fake shop header (brand
from catalog) → gallery placeholder + configurator column → gated
Add-to-Cart (configurator holds + `canProceed`) → "Try it" scripted steps
with the page's sample downloads → `?fcdebug=1` hint → collapsible
"how it's wired" linking the raw blueprint/workflow JSON.

Four fake brands give the categories continuity without new design work:
**Milldale Press** (stationery), **Campus Copy** (documents),
**Acme Signs** (large format, already exists), **Inkbird Apparel** (merch),
**Peel & Stick Co.** (stickers).

---

## 5. Sample file matrix

Generated by an extended `make-samples.mjs`; shared across products where
possible. New files needed (existing: `lowres.png`, `nobleed.pdf`,
`wrongsize.pdf`):

| File | Exercises | Used by |
| --- | --- | --- |
| `card-good.pdf`, `card-nobleed.pdf`, `card-tinytype.pdf` | bleed, min font | business-cards |
| `flyer-a5.pdf` | size-follows-selection | flyer-sizes |
| `leaflet-trifold.pdf`, `leaflet-onepage.pdf` | spreads/page count | folded-leaflet |
| `sticker-transparent.png`, `sticker-whitebg.png` | transparency, canvas pricing | stickers, tshirt |
| `thesis-48p-mixed.pdf`, `thesis-locked.pdf` | colour split, encryption | thesis |
| `booklet-16p.pdf`, `booklet-13p.pdf`, `booklet-spreads.pdf` | page count, spreads | booklet |
| `banner-3x1m.pdf`, `banner-8x3m.pdf` | area tiers, DPI-at-size | both banners |
| `poster-a1.pdf` | DPI-at-size | poster |
| `rollup-correct.pdf`, `rollup-2000.pdf` | fixed size + tail | rollup |
| `logo-transparent.png`, `logo-whitebg.png` | background/underbase | tshirt |
| `mug-wrap-11oz.pdf`, `mug-square.png` | template, aspect | mug |
| `photo-3x4.jpg`, `photo-pano.jpg` | aspect, resolution | canvas-print |

---

## 6. Build order (proposed)

1. **B1–B4** (schema + FilecheckUpload pass-through + `setContext` +
   context bridge); everything else depends on them.
2. `shop.html` template + `catalog.json` + **two pilot products** proving
   both flow directions: `flyer-sizes` (selections→check) and
   `thesis-per-page` (facts→price).
3. Sample generator extensions for the pilots; manifest entries;
   `check.mjs` green.
4. Remaining 11 blueprints in category batches, samples alongside.
5. Landing page rework (cards from catalog, filter chips, patterns
   section).
6. CDN mirror of 2–3 blueprints to `options.print.app/demo/samples/` as a
   smoke test of the published path.

Open questions parked for later: write-back into configurator inputs
("use my artwork's size"), a `context` extension beyond the five keys
(would unlock e.g. clear-vinyl→transparency-required), and whether
`photo-prints` earns a configurator treatment once multi-file fields
exist.
