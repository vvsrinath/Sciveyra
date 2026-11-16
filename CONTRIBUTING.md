# Contributing

Thanks for improving SciVeyra. The project is deliberately client-only: no backend, no account system and no paid or hosted AI services.

## Setup

Requirements: Node.js 20+ and npm.

```bash
git clone <repository-url>
cd sciveyra-frontend
npm install --legacy-peer-deps
npm run dev
```

The app runs at `http://127.0.0.1:5173/`.

`--legacy-peer-deps` is required by the current dependency graph. CI uses the same flag, so local and CI installs match.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run build
```

Add or update unit tests for any logic change. The graph suite is the reference example: every plot type and option has a regression test.

## Code layout

- `src/app` — routing, shell and providers.
- `src/features/<studio>` — one folder per screen. Feature-local components stay inside it.
- `src/components` — shared UI primitives and `PlotlyChart`.
- `src/lib` — framework-free logic, storage and export helpers. This is where testable behaviour belongs.
- `src/styles` — Tailwind entrypoint and global CSS.
- `tests` — Vitest suites mirroring `src/lib`.

Do not import one feature from another. Promote shared code to `src/lib` or `src/components` instead.

## Style

- Match the existing formatting: two spaces, no semicolons in TS/JS, single quotes.
- Prefer small pure functions in `src/lib` over logic inside components.
- Type React props and persisted records. `src/types.ts` is the shared contract.
- Use the existing primitives from `src/components/ui`.
- Light theme only. Do not add `dark:` variants or toggle a `dark` class.
- Sanitise every user-entered numeric option in `normalizeConfig` before it reaches Plotly.
- Keep imports lazy for route-level studios so bundle splitting is preserved.

## Data and privacy rules

- Sample data must carry `source: 'sample'` and a clear synthetic-data warning.
- Do not add telemetry, analytics, paid APIs or AI APIs.
- Outbound network requests must be user-triggered and limited to public scholarly metadata.
- Never commit tokens, credentials or personal data. `.env*` files are ignored; the app currently needs none.
- Browser storage is not a backup. Any new persisted collection must be included in `STORES`, backup export/import and the relevant types.

## Adding a plot type

1. Add the id and label to `PLOT_TYPES` in `src/lib/graphConfig.js`.
2. Build the trace in `buildPlotlyFigure`.
3. Add validation errors for required columns.
4. Expose any options in `GraphSettings.tsx` and add defaults in `defaultConfig`.
5. Extend `GraphConfig` in `src/types.ts`.
6. Add tests in `tests/graphFeatures.test.js`.
7. Verify in the browser at desktop and 390 px width.

## Reporting bugs

Include:

- the route and browser;
- steps to reproduce;
- expected and actual behaviour;
- console errors, if any;
- whether the data was imported or synthetic.
