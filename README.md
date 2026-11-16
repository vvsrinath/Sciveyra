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
- **Research Navigator** — search public metadata from Crossref and Europe PMC, review results and save them to the local reference library.
- **Reference Manager** — add, edit, filter and sort references; import/export BibTeX and RIS; deduplicate; copy formatted citations and in-text citations; resolve a DOI or title to metadata; add a reference from a PDF DOI.
- **Writing Lab** — Markdown draft editor with autosave, word targets, citation-style-aware insertion, rule-based writing checks and TXT/MD export.
- **Projects** — browse every stored collection, search/filter/sort, open or delete items and inspect storage usage.
- **Settings** — storage estimate, full JSON backup/restore, one-time legacy import, persistent-storage request and privacy notes.

## Design

SciVeyra uses one calm **light theme**. The `<html>` element never receives a `dark` class, so every page keeps a white canvas, soft slate borders and readable dark ink. Manrope is used for display headings and DM Sans for body text, with rounded cards, restrained gradient accents and subtle blue/violet/cyan ambient light.

Design tokens live in `tailwind.config.js`; shared primitives live in `src/components/ui.tsx`.

## Quick start

Requirements: Node.js 20 or newer (`.nvmrc` is provided).

```bash
npm install --legacy-peer-deps
npm run dev
```

Open `http://127.0.0.1:5173/`.

Production build and preview:

```bash
npm run build
npm run preview
```

`--legacy-peer-deps` is currently required because the PDF/test tool-chain declares peer ranges that npm 7+ resolves strictly. CI uses the same flag.

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
│   │   ├── research/          Metadata search and reference library
│   │   ├── writing-lab/      Draft editor and citation insertion
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

The suite covers parsing, statistics, curve fitting, references, metadata, storage, sample data, graph validation and figure building. Graph tests exercise every 2D type (`line`, `scatter`, `bar`, `area`, `histogram`, `box`, `errorbar`, `heatmap`, `contour`, `spectrum`) and every 3D type (`surface`, `mesh3d`, `scatter3d`), including error-bar alignment and all SigmaPlot-style options.

```bash
npm test
npm run typecheck
npm run build
```

## Storage and privacy

- Structured data is stored in IndexedDB in the database `sciveyra`.
- `localStorage` is read once to import data from older prototypes.
- Backups are plain JSON files exported from Settings. Browser storage is not a backup — export regularly.
- Research Navigator, DOI/title resolution and PDF DOI recovery contact Crossref, DataCite or Europe PMC directly only when you run an action. No proxy or AI service is used.

## Deployment

The app is a static single-page application. A ready-to-use Netlify configuration (`netlify.toml` and `public/_redirects`) builds with `npm run build` and redirects every route to `index.html`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Honest limitations

- Sample datasets are explicitly labelled **synthetic** and must not be treated as experimental measurements.
- Writing checks are simple heuristics. They are not a grammar checker and cannot reliably detect AI-generated text.
- Chart PDF export embeds a high-resolution raster image; it is not a native vector PDF. Use SVG for vector workflows.
- Raster-to-vector tracing suits line art, logos and simple diagrams, not photographs or continuous-tone microscopy.
- Vector tracing and image processing depend on browser canvas/WebGL support.
- Online metadata can be incomplete or wrong. Always verify against the publisher record before citing.
- Curve fits use least-squares with numerical gradients; compare candidates by adjusted R² and treat outliers as flags, not errors.
- Live figure panels require a local Plotly render; if a snapshot fails the placeholder box is kept and a warning is shown.
- PDF DOI recovery only finds machine-readable DOIs (or one in the filename); scanned PDFs may need the DOI entered manually.

Check each dependency's licence and browser compatibility before public or commercial distribution.
