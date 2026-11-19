# Graphing reference

All 2D and 3D plot behaviour lives in `src/lib/graphConfig.js`. The UI in `src/features/graph-studio` and `src/features/three-d-studio` only edits a `GraphConfig`; the builder turns that config plus a dataset into Plotly `{ data, layout }`.

## Data shape

A dataset is a table of columns (`c0`, `c1`, …) plus one row object per record:

```js
{
  id: 'dataset_...',
  name: 'Synthetic engine performance (sample)',
  source: 'sample' | 'manual' | 'import',
  columns: [{ key: 'c0', name: 'Engine load (%)', type: 'numeric' }, ...],
  rows: [{ c0: 0, c1: 8.12, c2: 44.9, c3: 0.42 }, ...],
  rowCount: 21,
  columnCount: 4
}
```

Only columns whose `type` is `numeric` or `mixed` appear in plot selectors. Missing cells are stored as `null` and are skipped by `pairedValues`, so they never become fake zeros.

### Long format for grids

Heatmaps, contours, surfaces and meshes expect **long format**: one row per grid cell with separate X, Y and Z columns.

```csv
X,Y,Z
0,0,1
1,0,2
0,1,4
1,1,5
```

`pivotGrid` collects the sorted unique X and Y values and fills a `z[y][x]` matrix. Cells with no row become `null`; surfaces use `connectgaps: false` and meshes simply omit missing vertices/triangles.

## 2D plot types

| `plotType` | Plotly trace | Required mapping | Notable options |
| --- | --- | --- | --- |
| `line` | `scatter`, `lines+markers` | numeric X + ≥1 Y | line shape, width, dash, markers, smoothing, dual axis, error bars |
| `scatter` | `scatter`, `markers` | numeric X + ≥1 Y | marker shape/size, error bars |
| `bar` | `bar` | numeric X + ≥1 Y | `barMode` = group / stack / relative / overlay, `bargap`, error bars |
| `area` | `scatter` + `fill: tozeroy` | numeric X + ≥1 Y | line options, translucent fill |
| `histogram` | `histogram` | ≥1 Y (X not required) | `histogramBins` (0 = auto), overlay mode |
| `box` | `box` | ≥1 Y (X not required) | `boxPoints` = outliers / suspectedoutliers / all / none |
| `errorbar` | `scatter`, `lines+markers` | numeric X + ≥1 Y + error columns | Y and/or X symmetric error arrays |
| `heatmap` | `heatmap` | X, Y and Z | colour scale, reverse scale, labels |
| `contour` | `contour` | X, Y and Z | heatmap colouring with contour labels |
| `spectrum` | `scatter` | numeric X + ≥1 Y | slightly thinner line for dense traces |

## 3D plot types

| `plotType` | Plotly trace | Required mapping | Notes |
| --- | --- | --- | --- |
| `surface` | `surface` | X, Y and Z | `connectgaps: false`, colour bar, optional XYZ contours, lighting presets, opacity |
| `mesh3d` | `mesh3d` | X, Y and Z | triangulates the grid; intensity is Z, lighting presets, optional flat shading, opacity |
| `scatter3d` | `scatter3d` | X, Y and Z | one marker per complete row; marker colour is Z, marker opacity control |

The scene layout always disables the 2D axes, sets `dragmode: orbit` in the studio, applies `showGrid` to all three scene axes and honours `reverseColorscale` for surface, mesh and scatter markers. `surfaceContours`, `surfaceLighting` (`soft`, `glossy`, `matte`, `flat`) and `surfaceOpacity` (0.2–1) are normalised with the config and round-trip through saved JSON.

## Error bars

Error values are **absolute magnitudes**, not variances. Both `errorKey` (vertical) and `xErrorKey` (horizontal) are supported.

Alignment is row-based, not X-based. For every series the builder walks the dataset rows and emits an error array only for rows where both X and that series' Y are numeric. This means:

- multi-series charts get a correctly aligned array per series;
- duplicate X values do not collide;
- missing Y values do not shift the error array;
- negative, `null`, blank and non-finite error values become `null` (no bar) rather than a negative length.

Validation warns when an error column has no usable numbers, contains negative values, or is no longer numeric.

## SigmaPlot-style options

| Option | Field | Behaviour |
| --- | --- | --- |
| `lineShape` | Line shape | `linear`, `spline`, `hv`, `vh`, `hvh`. `smoothing: true` forces `spline`. |
| `barMode` | Bar mode | Plotly `barmode` for bar charts. |
| `bargap` | Bar gap | Space between bar groups, 0–0.9. |
| `histogramBins` | Histogram bins | `nbinsx`; `0` lets Plotly choose. Clamped to 0–200. |
| `boxPoints` | Box points | Which raw points a box plot draws. |
| `errorKey` | Error bar column | Vertical symmetric error magnitudes. |
| `xErrorKey` | X error column | Horizontal symmetric error magnitudes. |
| `showMinorTicks` | Minor ticks | Adds small outside ticks. |
| `refLines` | Reference lines | Dashed X or Y rules. |
| `annotations` | Notes | Free text with optional data coordinates/arrow. |
| `hiddenSeries` | Legend toggles | Series become `legendonly`, preserving legend visibility. |
| `surfaceContours` | Contour lines | Draws X/Y/Z contour lines on `surface` traces. |
| `surfaceLighting` | Lighting | `soft`, `glossy`, `matte` or `flat` for `surface`/`mesh3d`; `flat` enables flat shading. |
| `surfaceOpacity` | Opacity | 0.2–1 for surfaces/meshes and 3D scatter markers. |

## Layout and style

`baseLayout` builds a light, publication-oriented layout with:

- 1000×620 default canvas, paper/plot background colours, font family and size;
- X/Y titles, optional secondary Y axis, log scales and explicit min/max ranges;
- thin grid lines drawn below traces, hidden zero lines, outside ticks and optional minor ticks;
- framed legend, styled hover labels and `.,` separators;
- reference-line shapes and free/fit annotations.

`buildPlotlyFigure(..., { fitLabel })` adds a non-interactive paper-coordinate annotation carrying the fit name, equation and R² so the chart remains interpretable when exported.

`axisRange` converts min/max values to Plotly ranges and uses `log10` for logarithmic axes. Incomplete ranges fall back to Plotly auto-ranging.

## Validation

`validateConfig(dataset, config)` returns `{ errors, warnings }`.

Errors block rendering:

- no dataset;
- no numeric X (except histogram/box);
- no numeric Y (except grid types);
- a selected column was removed or is no longer numeric;
- grid plots missing X, Y or Z;
- 3D scatter missing Z.

Warnings still render:

- log scale with non-positive values;
- error column with no usable values, negative values, or a length mismatch;
- X error column with no usable or negative values.

## Analysis panel

`src/features/graph-studio/AnalysisPanel.tsx` and `src/lib/stats.js` provide:

- descriptive statistics and 95% confidence intervals;
- Pearson and Spearman correlation;
- linear and polynomial regression;
- non-linear fits (exponential, logarithmic, power, Gaussian, Lorentzian) with model ranking;
- Grubbs and IQR outlier detection;
- moving average, min–max normalisation, z-score and numerical derivative previews;
- linear interpolation.

Regression results can be added as an extra dashed trace and as an on-chart fit/R² label. Graph Studio and the built-in Feature Tester both verify the label reaches the Plotly layout.

## Saved graphs and templates

- 2D saves write `mode: '2d'`; 3D saves write `mode: '3d'`.
- Graph Studio lists only 2D records; 3D Studio lists only 3D records.
- Autosave updates an open 2D graph after edits.
- Templates store a config without the title or hidden-series state.

## Export

`src/lib/export.js` handles:

- PNG, SVG and raster-embedded PDF through `Plotly.toImage`, with scale 3 by default (max 4) in both studios;
- dataset CSV;
- graph config JSON (with schema marker) and config import;
- sending an SVG snapshot to Figure Composer as an asset.

3D scenes export as raster images because WebGL surfaces cannot be serialised to SVG reliably.

## Testing checklist

`tests/graphFeatures.test.js`, `tests/graphConfig.test.js` and `src/lib/featureTests.js` cover the graph engine. When adding a plot type or option:

1. Add a builder case.
2. Add validation errors/warnings for unsafe mappings.
3. Add a test that the trace type, arrays, and layout fields are correct.
4. Add a matching check to the in-app Feature Tester when the option is user-facing.
5. Verify in the browser on `/graphs` and `/three-d` at desktop and mobile widths.
6. Run `npm run typecheck && npm test && npm run build`.
