# Deployment

SciVeyra is a static SPA. The production artefact is the `dist/` directory produced by `npm run build`.

## Build locally

```bash
npm ci
npm run build
npm run preview   # serves dist/ at http://127.0.0.1:4173/
```

`.npmrc` sets `legacy-peer-deps=true`, so both local and Netlify installs resolve the current peer ranges. The build runs `tsc -b` first, so type errors fail the build.

## Netlify

`netlify.toml` is committed and ready to use:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  NPM_FLAGS = "--legacy-peer-deps"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`.npmrc` also sets `legacy-peer-deps=true`, so the install works whether Netlify uses `npm install` or `npm ci`.

Steps:

1. Create a Netlify site from the repository.
2. Keep the base directory at the repository root (the Vite app lives there).
3. Confirm build command `npm run build` and publish directory `dist`.
4. Deploy. Netlify installs dependencies and runs the build.

`public/_redirects` duplicates the SPA rewrite for drag-and-drop deploys:

```text
/*    /index.html   200
```

Deep links such as `/graphs` and `/three-d` therefore work on refresh.

## Validate the Netlify build locally

The configuration can be exercised without a Netlify account:

```bash
npx netlify-cli@latest build --offline
```

This reads `netlify.toml`, runs `npm run build` in the production context and writes `dist/`. The generated `.netlify/` state folder is ignored by git.

A plain static file server is not enough to verify this app: deep links must fall back to `index.html`. If you test manually, use a SPA-aware server or Netlify Dev so `/graphs`, `/three-d`, `/figures` and the other routes resolve on refresh.

## Other static hosts

Any static host works if it serves `dist/` and rewrites unknown paths to `index.html`:

- **GitHub Pages** — publish `dist/` and add a `404.html` copy of `index.html`, or use a SPA-friendly action.
- **Vercel** — framework preset Vite, output `dist`, add a rewrite of `/(.*)` to `/index.html`.
- **Cloudflare Pages** — build command `npm run build`, output `dist`, SPA fallback enabled.
- **S3/CloudFront** — set the error document to `index.html` with a 200 response.

## Environment and secrets

The app needs no environment variables and no server secret. Do not add API keys for paid services; the only outbound calls are user-triggered public scholarly metadata requests (Crossref, DataCite, Europe PMC).

Never commit tokens or credentials. Use your host's secret store if a future integration needs one.

## Bundle notes

- Plotly is the largest chunk (~4.8 MB raw). It is lazy-loaded only when a chart mounts and is isolated in its own chunk by `vite.config.ts`.
- ExcelJS and jsPDF are also split into separate chunks.
- First load of a studio may take a moment on slow connections; the shell shows a spinner while the route chunk downloads.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm test
npm run build
```

Fix CI locally before pushing:

```bash
npm run typecheck && npm test && npm run build
```

## Verifying a deployment

1. Open `/` and confirm the landing page renders with a white background.
2. Visit each route directly (not only by clicking) to confirm SPA rewrites.
3. Open `/graphs`; wait for Plotly; switch through all ten 2D types.
4. Open `/three-d`; switch surface, mesh and scatter; toggle grids and reverse colours.
5. Import a small CSV, save a graph, reload, and reopen the saved graph.
6. Export PNG/SVG and download a backup from Settings.
7. Check the browser console for errors and confirm no horizontal overflow at 390 px width.
