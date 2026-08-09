/**
 * Demo-site plumbing. NOT part of a Filecheck integration.
 *
 * Every page here keeps its own Filecheck wiring inline and visible, because
 * the pages double as copy-paste examples. This file holds only the things a
 * real shop would never need: resolving which publishable key to demo with,
 * and pointing the iframe at a local dev server.
 *
 * Lives in `public/` so it is copied verbatim by the build and can be loaded
 * with a plain <script> from any page, dev or production.
 *
 * Key resolution, most specific first:
 *   1. ?pk= / ?workflow= on the URL     , one-off, wins everything
 *   2. localStorage                      . "Try your own key" on the landing
 *                                           page, so a printer enters it once
 *                                           and every demo inherits it
 *   3. the demo tenant's own key         , the default
 */
(function () {
    var STORE_KEY = 'fc-demo-key';
    var STORE_WF  = 'fc-demo-workflow';

    var DEFAULT_PK = 'pk_01KRX2E9SGXZCAXR7QZ2TW00YM';

    var params = new URLSearchParams(location.search);

    var read = function (name) {
        try { return localStorage.getItem(name) || ''; } catch (e) { return ''; }
    };
    var write = function (name, value) {
        try {
            if (value) localStorage.setItem(name, value);
            else localStorage.removeItem(name);
        } catch (e) { /* private browsing; the defaults still work */ }
    };

    var FCDemo = {
        /** The publishable key this page should demo with. */
        key: function () {
            return params.get('pk') || read(STORE_KEY) || DEFAULT_PK;
        },

        /**
         * The workflow id for a page that uses a SAVED workflow.
         * Pages that ship a transient inline workflow ignore this.
         */
        workflow: function (fallback) {
            return params.get('workflow') || params.get('wf') || read(STORE_WF) || fallback || '';
        },

        /** True when the visitor supplied their own key. */
        isCustomKey: function () {
            return !!(params.get('pk') || read(STORE_KEY));
        },

        /** Persist a visitor-supplied key so the other demos pick it up. */
        setKey: function (pk, workflowId) {
            write(STORE_KEY, (pk || '').trim());
            write(STORE_WF, (workflowId || '').trim());
        },

        /**
         * Options for the Filecheck() factory. On localhost the iframe points
         * at the @filecheck/client dev server (port 8010) instead of the CDN,
         * so client changes show up without a deploy.
         */
        options: function () {
            var opts = {};
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                opts.iframeSrc = 'http://localhost:8010/';
            }
            return opts;
        },

        /**
         * Mark a page as running in preview mode. Transient inline workflows
         * are preview-tagged server-side: unmetered, webhook-silent, and
         * short-retention; which is what lets these pages run against any
         * tenant without configuring anything in the admin.
         */
        preview: true,
    };

    window.FCDemo = FCDemo;

    /* ─── shared chrome ────────────────────────────────────────────────────
       Marks the current page in the demo bar and wires the "your own key"
       form when a page renders one. Purely cosmetic. */
    document.addEventListener('DOMContentLoaded', function () {
        var here = location.pathname.replace(/\/$/, '') || '/index.html';
        var links = document.querySelectorAll('.demo-bar a[href]');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href').replace(/\/$/, '');
            if (href === here || (here === '/index.html' && href === '/')) {
                links[i].classList.add('is-current');
            }
        }

        var badge = document.querySelector('[data-fc-key-badge]');
        if (badge && FCDemo.isCustomKey()) {
            badge.textContent = 'using your key';
            badge.hidden = false;
        }

        var form = document.querySelector('[data-fc-key-form]');
        if (!form) return;
        var pkInput = form.querySelector('[name="pk"]');
        var wfInput = form.querySelector('[name="workflow"]');
        if (pkInput) pkInput.value = params.get('pk') || read(STORE_KEY) || '';
        if (wfInput) wfInput.value = params.get('workflow') || read(STORE_WF) || '';

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            FCDemo.setKey(pkInput && pkInput.value, wfInput && wfInput.value);
            // Reload without the one-off query params so the stored key is
            // demonstrably what's driving the page.
            location.href = location.pathname;
        });

        var reset = form.querySelector('[data-fc-key-reset]');
        if (reset) reset.addEventListener('click', function () {
            FCDemo.setKey('', '');
            location.href = location.pathname;
        });
    });
})();
