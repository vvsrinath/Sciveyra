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

# CORS-only proxies for public scholarly APIs. No keys or secrets.
[[redirects]]
  from = "/api/crossref/*"
  to = "https://api.crossref.org/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/europepmc/*"
  to = "https://www.ebi.ac.uk/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/arxiv/*"
  to = "https://export.arxiv.org/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/api/unpaywall/*"
  to = "https://api.unpaywall.org/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`.npmrc` also sets `legacy-peer-deps=true`, so the install works whether Netlify uses `npm install` or `npm ci`.

### Connect the GitHub repository in Netlify (no token)

The deployment is repository-connect only. Do not paste a personal access token into Netlify or the repository.

1. Sign in at <https://app.netlify.com/> and choose **Add new site → Import an existing project**.
2. Choose **Deploy with GitHub**. If prompted, authorize the Netlify GitHub app for the `vvsrinath/Sciveyra` repository only.
3. Pick the repository `vvsrinath/Sciveyra`. Do not fork unless you intend to maintain a separate copy.
4. On the build settings screen leave **Base directory** empty. Set **Build command** to `npm run build` and **Publish directory** to `dist`. Netlify should detect `netlify.toml`; confirm the values shown match it.
5. Leave **Environment variables** empty. Do not add an API key, GitHub token or Unpaywall email.
6. Click **Deploy site**. Netlify installs dependencies (using `.npmrc`/`NPM_FLAGS`), runs `npm run build` and publishes `dist/`.
7. After the first deploy, open **Site configuration → Change site name** if you want a friendly URL. Later pushes to the connected branch trigger deploys automatically.
8. Verify the site by opening `/`, then `/graphs`, `/three-d`, `/navigator`, `/rewriter` and `/tester` directly. Each should render, not 404.

If Netlify reports a build failure, check the deploy log for the `npm run build` line and reproduce locally with `npm ci && npm run build`. The repository root is the Vite app; there is no separate frontend subdirectory on this branch.

`public/_redirects` duplicates the SPA rewrite for drag-and-drop deploys:

```text
/*    /index.html   200
```

Deep links such as `/graphs` and `/three-d` therefore work on refresh.

## Offline support (PWA)

The production build registers a hand-written `public/sw.js` (only when `import.meta.env.PROD` is true, so local HMR is unaffected). It precaches the app shell (`/`, `/index.html`, `/favicon.svg`, `/manifest.webmanifest` and the icons), serves hashed `/assets/*` cache-first, and uses a network-first strategy for navigations with the cached shell as the offline fallback. SPA rewrites are untouched: deep links still resolve to `index.html` on refresh.

Only same-origin static assets are cached, and only for GET requests. `/api/*` metadata rewrites, cross-origin metadata providers, Ollama endpoints and non-GET requests are never cached. User data stays in IndexedDB and is never written to the service worker cache. Netlify headers keep `sw.js` and `index.html` revalidated, mark `/assets/*` immutable, and serve the manifest as `application/manifest+json`.

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

The app needs no environment variables and no server secret. Do not add API keys for paid services or a GitHub token. Outbound calls are user-triggered public scholarly metadata requests: OpenAlex and DOAJ direct, Crossref/DataCite/Europe PMC/arXiv/Unpaywall through same-origin rewrites where needed. Unpaywall email and optional Ollama endpoint/model are entered in the UI and stored only in the user's browser.

Never commit tokens or credentials. Repository-connect deployment uses Netlify's GitHub app authorization, not a token in this repository. Use your host's secret store if a future integration needs one.

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
6. Open `/navigator`, choose one or two sources and run a short search. Confirm provider errors are shown honestly if a source is unavailable. Enter your own Unpaywall email only if you want OA enrichment.
7. Open `/rewriter`, load the example and rewrite locally. Optionally point it at a self-hosted Ollama endpoint; no key is required or stored on the server.
8. Open `/tester` and confirm all 17 local checks pass in the deployed browser. Export the JSON report if useful.
9. Export PNG/SVG and download a backup from Settings.
10. Check the browser console for errors and confirm no horizontal overflow at 390 px width.
