/**
 * Runtime for the combined Filecheck × Print Options product pages.
 *
 * Filecheck is the show here: the intake mounts as a STANDALONE element in
 * the page's hero column, and the Print Options configurator renders the
 * options + price as a side rail. The two talk over public surfaces only:
 *
 *   Filecheck -> form   intake `status`  -> po.setFile() + holds
 *   form -> Filecheck   po `change`      -> intake.setContext()
 *
 * The blueprint JSON stays the single source of truth: it still carries the
 * file field with the inline workflow (that is what real embedded
 * integrations and the price-verified manifests use). This page extracts
 * that field at runtime, removes its section from the copy handed to the
 * configurator, and drives the standalone element with it.
 *
 * Two hosts share this file:
 *   - shop.html?product=<slug>: renders ALL chrome from catalog.json.
 *   - the generated static pages (/<slug>/): chrome is prerendered for
 *     crawlers (body carries data-shop-prerendered); only the live pieces
 *     mount here.
 *
 * Loads after demo.js; all URLs resolve through FCDemo so the same file
 * works at '/' (demo.filecheck.io) and '/demos/' (filecheck.io/demos).
 */
(function () {
    'use strict';

    var params = new URLSearchParams(location.search);
    var slug = window.__FC_PRODUCT__ || params.get('product') || 'flyers';
    var prerendered = document.body.hasAttribute('data-shop-prerendered');

    var HOLD_KEY = 'filecheck';
    var SOURCE = 'filecheck';

    function text(sel, value) {
        var el = document.querySelector(sel);
        if (el) el.textContent = value;
    }

    /* ─── chrome (shop.html only; static pages prerender all of this) ── */

    function renderChrome(entry) {
        document.title = entry.brand + ' · ' + entry.title;
        text('[data-shop-brand]', entry.brand);
        text('[data-shop-breadcrumb]', entry.breadcrumb);
        text('[data-shop-title]', entry.title);
        text('[data-shop-copy]', entry.copy);
        text('[data-shop-config-url]', FCDemo.url(entry.config));

        var swatch = document.querySelector('[data-shop-swatch]');
        if (swatch) {
            swatch.textContent = entry.swatch;
            if (entry.swatchClass) swatch.classList.add(entry.swatchClass);
        }

        var link = document.querySelector('[data-shop-config-link]');
        if (link) link.href = FCDemo.url(entry.config);

        var steps = document.querySelector('[data-shop-try-steps]');
        var samples = document.querySelector('[data-shop-samples]');
        var tryBox = document.querySelector('[data-shop-try]');
        if (tryBox && steps && samples) {
            (entry.tryIt || []).forEach(function (step) {
                var li = document.createElement('li');
                li.textContent = step;
                steps.appendChild(li);
            });
            (entry.samples || []).forEach(function (sample) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                a.href = FCDemo.url(sample.href);
                a.textContent = sample.label;
                a.setAttribute('download', '');
                li.appendChild(a);
                samples.appendChild(li);
            });
            tryBox.hidden = false;
        }
    }

    /* ─── blueprint split ─────────────────────────────────────────────── */

    /**
     * Pull the Filecheck file field out of the blueprint and return the
     * trimmed copy the configurator should render. The removed field's
     * inline workflow + ui copy drive the standalone element instead.
     */
    function splitBlueprint(config) {
        var trimmed = JSON.parse(JSON.stringify(config));
        var fileField = null;

        trimmed.sections = trimmed.sections.filter(function (section) {
            var rest = section.fields.filter(function (field) {
                if (field.type === 'file' && field.providerId === 'filecheck' && !fileField) {
                    fileField = field;
                    return false;
                }
                return true;
            });
            section.fields = rest;
            return rest.length > 0;
        });

        return { trimmed: trimmed, fileField: fileField };
    }

    /* ─── selection -> IntakeContext bridge (host-side) ───────────────── */

    /* Mirrors the configurator's own bridge (core-ui context-bridge.ts),
       which no longer runs once the file field leaves the form: implicit
       mappings for dimensions fields and numeric pages roles, explicit
       option-level filecheck.context patches, per-key merge in document
       order. Visibility rules are not evaluated here; none of the demo
       blueprints put context-carrying fields behind visibleWhen. */

    var MM_PER_UNIT = { mm: 1, cm: 10, in: 25.4 };
    var CONTEXT_KEYS = ['artworkSize', 'pageCount', 'fileCount', 'bleed', 'safety'];

    function round1(n) { return Math.round(n * 10) / 10; }

    function buildContext(config, selections) {
        var patches = [];

        config.sections.forEach(function (section) {
            section.fields.forEach(function (field) {
                var value = selections[field.id];
                if (value === undefined || value === '' || value === null) return;

                if (field.type === 'dimensions' && typeof value === 'object' &&
                        typeof value.w === 'number' && typeof value.h === 'number') {
                    var factor = MM_PER_UNIT[value.unit] || 1;
                    patches.push({ artworkSize: {
                        width_mm: round1(value.w * factor),
                        height_mm: round1(value.h * factor),
                    } });
                    return;
                }

                if (field.role === 'pages') {
                    var n = typeof value === 'number' ? value : Number(value);
                    if (isFinite(n) && n > 0) patches.push({ pageCount: { min: n, max: n } });
                }

                if (Array.isArray(field.options)) {
                    var ids = Array.isArray(value) ? value : [String(value)];
                    ids.forEach(function (id) {
                        var choice = field.options.find(function (o) { return o.id === id; });
                        var patch = choice && choice.filecheck && choice.filecheck.context;
                        if (patch) patches.push(patch);
                    });
                }
            });
        });

        if (!patches.length) return null;
        var merged = {};
        patches.forEach(function (patch) {
            CONTEXT_KEYS.forEach(function (key) {
                if (patch[key]) merged[key] = Object.assign({}, merged[key] || {}, patch[key]);
            });
        });
        return merged;
    }

    /* ─── Filecheck facts -> Print Options FileRecord ─────────────────── */

    function statusToFileRecord(status) {
        var facts = status.facts && status.facts.aggregate;
        var first = (status.files && status.files[0]) || {};
        var record = {
            fileId: status.jobId,
            source: SOURCE,
            status: 'ready',
        };
        if (first.name) record.fileName = first.name;
        if (facts) {
            if (facts.pageCount != null) record.pages = facts.pageCount;
            if (facts.colorPageCount != null) record.colorPages = facts.colorPageCount;
            if (facts.monoPageCount != null) record.monoPages = facts.monoPageCount;
            if (facts.width != null && facts.height != null) {
                record.canvas = { w: facts.width, h: facts.height, unit: 'mm' };
            }
        }
        return record;
    }

    /* ─── boot ────────────────────────────────────────────────────────── */

    function whenElementReady(cb) {
        var started = Date.now();
        (function tick() {
            if (window.Filecheck) return cb();
            if (Date.now() - started > 10000) {
                return text('[data-shop-title]', 'Filecheck failed to load');
            }
            setTimeout(tick, 50);
        })();
    }

    function mountFilecheck(fileField, onStatus) {
        var fc = Filecheck(FCDemo.key(), FCDemo.options());
        var intake = fc.elements.create('intake', {
            workflow: fileField.filecheck.workflow,
            preview: FCDemo.preview,
        });
        intake.on('status', onStatus);
        var heading = document.querySelector('[data-fc-hero-label]');
        if (heading && fileField.label && !prerendered) heading.textContent = fileField.label;
        var hint = document.querySelector('[data-fc-hero-hint]');
        if (hint && fileField.helpText && !prerendered) hint.textContent = fileField.helpText;
        intake.mount('#fc-hero-slot');
        return intake;
    }

    function mountConfigurator(entry, trimmed) {
        var po = document.createElement('print-configurator');
        po.setAttribute('product-id', entry.productId);
        po.setAttribute('upload-endpoint', 'https://api.print.app/po/secure-upload');
        po.setAttribute('data-verify-endpoint', 'https://api.print.app/po/verify-price');

        /* Store-level provider config still names Filecheck as the data
           provider (facts arrive via the Page API rather than an embedded
           field); the publishable key lives here, never in the blueprint. */
        var provider = {
            id: 'filecheck',
            name: 'Filecheck',
            mode: 'push',
            capabilities: {
                pages: true,
                colorDetection: true,
                pageSizes: true,
                canvas: true,
                preflightIssues: true
            }
        };
        po.setAttribute('provider', JSON.stringify(provider));

        po.addEventListener('submit', function (event) {
            var detail = (event.detail && event.detail[0]) || {};
            var price = detail.price || {};
            alert(
                'Added to cart (demo).\n' +
                'Verified total: ' + (price.currency || '') + ' ' + (price.total != null ? price.total : 'n/a')
            );
        });

        document.getElementById('po-slot').appendChild(po);

        // The trimmed blueprint rides in as a DOM property; the element's
        // config watcher handles it arriving after mount.
        customElements.whenDefined('print-configurator').then(function () {
            po.config = trimmed;
        });
        return po;
    }

    fetch(FCDemo.url('catalog.json'))
        .then(function (res) { return res.json(); })
        .then(function (catalog) {
            var entry = catalog.products && catalog.products[slug];
            if (!entry) {
                text('[data-shop-title]', 'Unknown product “' + slug + '”');
                text('[data-shop-copy]', 'Pick a demo from the bar above.');
                return null;
            }
            if (!prerendered) renderChrome(entry);
            return fetch(FCDemo.url(entry.config))
                .then(function (res) { return res.json(); })
                .then(function (config) { return boot(entry, config); });
        })
        .catch(function (err) {
            text('[data-shop-title]', 'Could not load the demo catalog');
            text('[data-shop-copy]', String(err));
        });

    function boot(entry, config) {
        var parts = splitBlueprint(config);
        if (!parts.fileField || !parts.fileField.filecheck || !parts.fileField.filecheck.workflow) {
            text('[data-shop-title]', 'This product has no inline Filecheck workflow');
            return;
        }

        var po = mountConfigurator(entry, parts.trimmed);

        whenElementReady(function () {
            var intake = mountFilecheck(parts.fileField, applyStatus);

            /* The cart stays held until Filecheck clears the artwork. */
            var wirePo = function () {
                if (typeof po.addHold !== 'function') return setTimeout(wirePo, 50);
                po.addHold(HOLD_KEY, { message: 'Upload your artwork; Filecheck must pass it first.', source: SOURCE });

                // Selections -> check. Seed once as soon as the widget has
                // state (polled: its `ready` event can fire before this
                // listener exists when the SDK loads slower than the form),
                // then follow every change that was not our own echo.
                var push = function (state) {
                    intake.setContext(buildContext(config, (state && state.selections) || {}));
                };
                var seeded = false;
                (function seed() {
                    if (seeded) return;
                    if (po.state) { seeded = true; return push(po.state); }
                    setTimeout(seed, 100);
                })();
                po.addEventListener('change', function (e) {
                    var detail = e.detail || {};
                    if (detail.source === SOURCE) return;
                    seeded = true;
                    push(detail.state || po.state);
                });
            };
            wirePo();

            function applyStatus(payload) {
                if (typeof po.setFile !== 'function') return;
                if (payload.canProceed && payload.jobId) {
                    po.setFile(statusToFileRecord(payload), { source: SOURCE });
                    po.releaseHold(HOLD_KEY, { source: SOURCE });
                } else {
                    po.setFile(null, { source: SOURCE });
                    po.addHold(HOLD_KEY, {
                        message: payload.status === 'rejected'
                            ? 'Filecheck rejected the file; replace it to continue.'
                            : 'Upload your artwork; Filecheck must pass it first.',
                        source: SOURCE,
                    });
                }
            }

            // Debug seam: ?fcdebug=1 pages and tests reach the live pieces.
            window.__FC_PAGE__ = { intake: intake, po: po, applyStatus: applyStatus, config: config };
        });
    }
})();
