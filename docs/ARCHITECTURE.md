# Architecture

SciVeyra is a client-only React single-page application. There is no server component: parsing, plotting, image processing, bibliography formatting, storage and export all run in the browser.

## Layers

```text
main.tsx
  └─ BrowserRouter
       └─ AppProvider          global toasts + refresh counter
            └─ App.tsx         lazy route table
                 └─ Shell       sidebar, header, local-storage status
                      └─ feature page
                           ├─ components/ui.tsx      shared primitives
                           ├─ components/PlotlyChart lazy Plotly wrapper
                           ├─ lib/*.js               framework-free domain logic
                           └─ lib/storage.js         IndexedDB access
```

Rules of thumb:

- **`src/app`** owns cross-page concerns: routing, the shell and React context.
- **`src/features/<studio>`** owns screens and studio-local components. A feature may import from `components/` and `lib/`, never from another feature.
- **`src/lib`** must remain framework-free. Functions are plain JavaScript with JSDoc types so they can be tested without a DOM.
- **`src/components`** holds only genuinely shared UI. Plotly is loaded lazily by `PlotlyChart`.
- **`src/types.ts`** is the single source of truth for persisted and shared shapes.

## Routing

`src/app/App.tsx` lazily imports each studio:

| Route | Feature folder |
| --- | --- |
| `/` | `features/landing` |
| `/home` | `features/home` |
| `/graphs` | `features/graph-studio` |
| `/three-d` | `features/three-d-studio` |
| `/images` | `features/image-studio` |
| `/vector` | `features/vector-studio` |
| `/figures` | `features/figure-composer` |
| `/diagrams` | `features/diagram-studio` |
| `/navigator` | `features/research/ResearchNavigator` (Reference Finder) |
| `/references` | `features/research/ReferenceManager` |
| `/writing` | `features/writing-lab` |
| `/rewriter` | `features/text-lab/ParagraphRewriter` |
| `/toolkit` | `features/toolkit/ResearchToolkit` (native map, external directory, qualitative coder) |
| `/contact` | `features/contact/Contact` |
| `/tester` | `features/testing/FeatureTester` |
| `/projects` | `features/projects` |
| `/settings` | `features/settings` |

Unknown paths redirect to `/home`. Netlify rewrites all paths to `index.html` so deep links work in production.

## Domain helpers

- `src/lib/drafting.js` defines local outline templates, section parsing/guidance and claim helpers. It builds clean Markdown skeletons (prompts stay in the UI), tracks claims by draft offsets and exports a readable evidence map.
- `src/lib/metadata.js` normalises OpenAlex, DOAJ, Europe PMC, Crossref, arXiv and Unpaywall payloads, deduplicates results and builds external patent/pattern links. Browser-incompatible providers fall back to same-origin `/api/*` rewrites defined in `netlify.toml` and `vite.config.ts`.
- `src/lib/rewriter.js` performs deterministic local paragraph rewriting and optionally calls a user-supplied self-hosted Ollama endpoint. It protects numbers, units, DOIs, URLs and citation markers; no key or hosted service is involved.
- `src/lib/toolDirectory.js` is the single source of truth for the research-tool map. `kind: 'native'` entries point to real routes; `kind: 'external'` entries point to provider websites and carry an access label so paid/proprietary services are never claimed as built in.
- `src/lib/qualCoding.js` provides literal, case-insensitive code counts, context snippets and escaped CSV export for the Toolkit's session-only qualitative coder.
- `src/lib/siteMeta.js` holds the exact developer name, public links and copyright line used by the landing page, shell footer and contact page.
- `src/lib/featureTests.js` uses the same pure builders as the studios. `runFeatureTests` never throws for a failed check, so the Feature Tester can show a complete report.

## State and storage

- `AppProvider` (`src/app/AppContext.tsx`) exposes `notify`, `markSaved`, save status, the toast stack and a `refreshToken` counter used to refresh aggregate views.
- Each studio loads its own records on mount with `dbGetAll`. The reusable `useAutosave` hook debounces writes and reports status through `AppProvider`.
- IndexedDB is accessed through `idb` in `src/lib/storage.js`. The database is `sciveyra`, schema version `2`.
- Stores: `datasets`, `graphs`, `figures`, `diagrams`, `drafts`, `references`, `assets`, `projects`, `settings`, `meta`, `versions`, `searchCache`.
- `dbPut` adds `updatedAt`/`createdAt` when missing and saves a bounded "before" image to `versions` for user records. `listVersions`, `restoreVersion`, `deleteVersion` and `clearHistory` power the Version History page. Writing Lab also keeps an in-session undo/redo stack via `src/lib/history.js`.
- `drafts` may carry a chosen outline `template` and an array of `claims`. Each claim stores its selected text, offsets, section heading and `referenceIds` that point into the `references` store; applying an outline clears old claims. Draft edits, including claim links, are autosaved, snapshotted and included in JSON backups.
- `searchCache` is volatile derived data: it is excluded from backups, cleared with local data and not counted in Settings totals. Reference Finder stores pre-Unpaywall results there and labels cached/stale results in the UI.
- The Toolkit qualitative coder intentionally uses React state only. It writes no IndexedDB store, appears in no backup and must be exported as CSV before leaving the page.
- `exportBackup` and `importBackup` move durable collections (including version history) as JSON.
- Graph records carry an optional `mode` of `'2d' | '3d'`. Graph Studio filters to `mode !== '3d'`; 3D Studio filters to `mode === '3d'`, so the two studios never show each other's saved scenes.
- Older records without `mode` are treated as 2D.

## Plotting pipeline

1. A dataset is imported and normalised by `src/lib/parse.js`.
2. A `GraphConfig` is created with `defaultConfig(dataset)` and sanitised by `normalizeConfig`.
3. `validateConfig(dataset, config)` returns human-readable errors and warnings.
4. `buildPlotlyFigure(dataset, config, options)` returns `{ data, layout }`.
5. `<PlotlyChart>` lazy-loads `plotly.js-dist-min` and calls `Plotly.react` whenever data or layout identity changes.
6. Export goes through `src/lib/export.js` (`Plotly.toImage` for charts, `html2canvas`/`jsPDF` for composites).

`buildPlotlyFigure` is pure and synchronous. Keeping it independent of React is what makes the full plot matrix testable in `tests/graphFeatures.test.js`.

See [`GRAPHING.md`](GRAPHING.md) for plot-by-plot details.

## Adding a feature

1. Create `src/features/<name>/<Name>.tsx`.
2. Add a lazy import and a route in `src/app/App.tsx`.
3. Add navigation in `src/app/Shell.tsx` and, if appropriate, the Home dashboard.
4. Put reusable calculations in `src/lib/` and unit-test them.
5. Persist new record types by extending `STORES`, `src/types.ts` and the backup flow together.
6. Run `npm run typecheck && npm test && npm run build`.

Never import one feature from another. If two features need the same behaviour, move it to `src/lib` or `src/components`.

## Conventions

- TypeScript for React and shared contracts; plain JavaScript + JSDoc for `src/lib`.
- Function components and hooks only.
- Tailwind utility classes; design tokens in `tailwind.config.js`. Use the shared `.glass-panel`, `.glass-subtle` and `.glass-chip` classes in `src/styles/index.css` for new surfaces rather than ad hoc blur utilities.
- Light theme only. Do not add `dark:` variants or toggle a `dark` class.
- Every numeric option should be finite by the time it reaches Plotly; sanitise in `normalizeConfig`.
- Synthetic data must keep `source: 'sample'` and a warning that it is not experimental.
- Do not add paid or hosted AI APIs. Network calls are limited to public scholarly metadata (direct or same-origin `/api/*` proxies) and, only if the user opts in, a self-hosted Ollama endpoint entered in the browser settings.
