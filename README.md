# SciVeyra

A local-first, browser-based scientific research and visual creation workspace built with React, TypeScript, Vite and Tailwind CSS.

Everything runs in the browser. No account, backend, paid API or AI API is required. Research data is stored in IndexedDB and stays private to the current browser profile.

## Tools

- **Graph Studio** — import CSV/TSV/Excel, edit data in a table, and plot line, scatter, bar, area, histogram, box, error-bar, heatmap, contour and spectrum charts. Includes dual Y axes, X/Y error bars, grouped/stacked/relative/overlay bars, histogram bin control, box-point modes, line shapes (linear, spline, step), reference lines, annotations, statistics, correlation, regression, non-linear curve fitting, outlier detection and interpolation. Save graphs/templates and export PNG, SVG, PDF, CSV or config JSON.
- **3D Graph Studio** — interactive 3D scatter, surface and mesh plots from real XYZ data with camera presets, five colour scales, grid and reverse-colour toggles, axis summaries and PNG/PDF export. Saved 3D graphs can be reopened or deleted from the studio.
- **Image Studio** — crop, rotate, resize, adjust brightness/contrast/grayscale and export PNG/JPEG entirely in the browser.
- **Vector Studio** — trace high-contrast raster artwork into sanitised SVG paths with ImageTracerJS, then export or send to Figure Composer.
- **Figure Composer** — compose multi-panel figures from graph assets, traces, local images and live graph panels, with labels, captions, drag/resize, auto-grid, alignment and PNG/SVG/PDF export.
- **Diagram Studio** — build flowcharts and schematics with draggable nodes and labelled connections, then export PNG/SVG/PDF.
- **Reference Finder** — search free scholarly metadata from OpenAlex, DOAJ, Europe PMC / PubMed Central, Crossref and arXiv; resolve OA links with your own Unpaywall email; review and save records. A peer-reviewed bundle queries OpenAlex + DOAJ + Europe PMC + Crossref. Patent/IP and pattern rows link out to external search engines rather than inventing results.
- **Reference Manager** — add, edit, filter and sort references; import/export BibTeX and RIS; deduplicate; copy formatted citations and in-text citations; resolve a DOI or title to metadata; add a reference from a PDF DOI.
- **Writing Lab** — Markdown draft editor with autosave, word targets, citation-style-aware insertion, rule-based writing checks and TXT/MD export.
- **Paragraph Rewriter** — local deterministic humanising/rewriting with protected numbers, units, DOIs, URLs and citations. Optionally use a self-hosted Ollama endpoint/model you supply; no paid AI API or key is required.
- **Feature Tester** — run 17 in-app checks across datasets, every 2D and 3D graph type, analysis, exports, references, rewriting and browser capabilities; export a JSON report.
- **Projects** — browse every stored collection, search/filter/sort, open or delete items and inspect storage usage.
- **Settings** — storage estimate, full JSON backup/restore, one-time legacy import, persistent-storage request and privacy notes.

## Design

SciVeyra uses one calm **light theme**. The `<html>` element never receives a `dark` class, so every page keeps a white canvas, soft slate borders and readable dark ink. Cards, headers, sidebars and controls share restrained white glass surfaces (`.glass-panel`, `.glass-subtle`, `.glass-chip`) with a subtle blue-tinted ambient wash. Manrope is used for display headings and DM Sans for body text.

Design tokens live in `tailwind.config.js`; shared primitives live in `src/components/ui.tsx`; glass effects are defined once in `src/styles/index.css`.

## Quick start

Requirements: Node.js 20 or newer (`.nvmrc` is provided).

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

Production build and preview:

```bash
npm run build
npm run preview
```

`.npmrc` sets `legacy-peer-deps=true`, so plain `npm install` and `npm ci` both work locally and on Netlify. This is required by the current PDF/test tool-chain peer ranges.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Typecheck, then create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the Vitest unit suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run typecheck` | Run the TypeScript project build without emitting. |
| `npm run coverage` | Run tests with V8 coverage. |

## Project structure

```text
sciveyra-frontend/
├── docs/                     Developer guides (architecture, graphing, deployment)
├── public/                   Static files copied as-is (favicon, SPA redirects)
├── src/
│   ├── app/                  Application shell, providers and route table
│   ├── components/           Shared UI primitives and the Plotly wrapper
│   ├── features/             One folder per user-facing studio
│   │   ├── graph-studio/     2D plotting and analysis
│   │   ├── three-d-studio/   3D plotting
│   │   ├── image-studio/     Raster editing
│   │   ├── vector-studio/    Raster-to-vector tracing
│   │   ├── figure-composer/  Multi-panel figure layout
│   │   ├── diagram-studio/   Flowcharts and schematics
│   │   ├── research/          Multi-source Reference Finder and reference library
│   │   ├── writing-lab/      Draft editor and citation insertion
│   │   ├── text-lab/         Local/Ollama paragraph rewriter
│   │   ├── testing/          Built-in feature tester
│   │   ├── home/             Dashboard
│   │   ├── landing/          Public marketing page
│   │   ├── projects/          Library browser
│   │   └── settings/          Backup, restore and privacy
│   ├── lib/                  Framework-free domain logic and storage
│   ├── styles/               Tailwind entrypoint and global CSS
│   ├── types.ts              Shared TypeScript contracts
│   └── main.tsx              Browser entrypoint
├── tests/                    Vitest unit tests
├── index.html
├── netlify.toml              Netlify build and SPA redirects
├── tailwind.config.js
├── vite.config.ts
└── tsconfig*.json
```

Conventions:

- Feature folders own their UI. Reusable logic belongs in `src/lib/` and must stay framework-free so it can be unit tested without React.
- Import shared UI from `src/components/ui`, not from another feature.
- Keep route components lazy-loaded in `src/app/App.tsx` so each studio stays in its own bundle.
- New plot behaviour belongs in `src/lib/graphConfig.js` (builder + validation) and gets a regression test in `tests/`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/GRAPHING.md`](docs/GRAPHING.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for details.

## Testing

The suite covers parsing, statistics, curve fitting, references, multi-source discovery adapters, rewriting, the built-in test runner, storage, sample data, graph validation and figure building. Graph tests exercise every 2D type (`line`, `scatter`, `bar`, `area`, `histogram`, `box`, `errorbar`, `heatmap`, `contour`, `spectrum`) and every 3D type (`surface`, `mesh3d`, `scatter3d`), including error-bar alignment, fit labels, publication defaults and 3D contour/lighting/opacity controls.

```bash
npm test
npm run typecheck
npm run build
```

## Storage and privacy

- Structured data is stored in IndexedDB in the database `sciveyra`.
- `localStorage` is read once to import data from older prototypes.
- Backups are plain JSON files exported from Settings. Browser storage is not a backup — export regularly.
- Reference Finder, DOI/title resolution and PDF DOI recovery contact providers only when you run an action. OpenAlex and DOAJ are direct CORS-safe calls; Crossref, Europe PMC, arXiv and Unpaywall use same-origin Netlify/Vite proxies where needed. No proxy, app server or AI service sees a stored secret; Unpaywall email and optional Ollama settings stay in this browser.

## Deployment

The app is a static single-page application. A ready-to-use Netlify configuration (`netlify.toml` and `public/_redirects`) builds with `npm run build`, redirects every route to `index.html`, and maps `/api/*` same-origin paths to public metadata providers so browser CORS restrictions do not break search. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for exact GitHub repo-connect steps.

## Honest limitations

- Sample datasets are explicitly labelled **synthetic** and must not be treated as experimental measurements.
- Writing checks are simple heuristics. They are not a grammar checker and cannot reliably detect AI-generated text.
- Chart PDF export embeds a high-resolution raster image; it is not a native vector PDF. Use SVG for vector workflows.
- Raster-to-vector tracing suits line art, logos and simple diagrams, not photographs or continuous-tone microscopy.
- Vector tracing and image processing depend on browser canvas/WebGL support.
- Online metadata can be incomplete or wrong. Always verify against the publisher record before citing. OpenAlex has a shared free daily budget per network IP; proxies cannot increase that quota.
- Unpaywall rejects placeholder emails; enter your own address in Reference Finder. Europe PMC/arXiv/Crossref availability depends on the provider and network; source errors are reported without inventing results.
- IP/patent and pattern rows open external search websites. SciVeyra does not claim to have retrieved or verified those results for you.
- Optional Ollama rewriting depends on a model you host yourself, browser CORS settings and the model's quality. It can hallucinate; review every change. Local rules are the default.
- Curve fits use least-squares with numerical gradients; compare candidates by adjusted R² and treat outliers as flags, not errors.
- Live figure panels require a local Plotly render; if a snapshot fails the placeholder box is kept and a warning is shown.
- PDF DOI recovery only finds machine-readable DOIs (or one in the filename); scanned PDFs may need the DOI entered manually.

Check each dependency's licence and browser compatibility before public or commercial distribution.
