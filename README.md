# @filecheck/demo

A static product-page demo for the [Filecheck Element](https://github.com/PrintApp/filecheck-element).

Two integration modes:

- **Inline**     — element mounted directly above the *Add to Cart* button
- **Modal**      — same element, opened on demand inside a `<dialog>` overlay

Both modes load the element exactly the way a real tenant does:

```html
<script async src="https://cdn.filecheck.io/element/v1/filecheck.js"></script>
```

In local dev that URL is served by a tiny Vite plugin reading
`packages/element/dist/filecheck.js`, so any rebuild of the element shows
up after a page refresh.

## Run

```bash
# from the monorepo root
pnpm --filter @filecheck/element build      # one-off, or run dev:element
pnpm dev:demo                                # http://localhost:5174
```

The element's iframe defaults to the production client
(`https://cdn.filecheck.io/client/v1/`). In dev mode the demo overrides
`iframeSrc` to `http://localhost:8010/` — start the client app with
`pnpm dev:client` if you want to iterate on the iframe UI as well.
