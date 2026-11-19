import { buildDataset, datasetToCSV, numericColumns, parseDelimitedText } from './parse.js'
import { sampleEngineDataset, sampleSurfaceDataset } from './sampleData.js'
import {
  buildPlotlyFigure, defaultConfig, LIGHTING_PRESETS, normalizeConfig,
  PLOT_TYPES, validateConfig
} from './graphConfig.js'
import {
  describe, iqrOutliers, linearInterpolate, linearRegression, nonlinearFit, pearson,
  polynomialRegression, spearman
} from './stats.js'
import {
  CITATION_STYLES, dedupeReferences, exportBibTeX, formatCitation, normalizeReference
} from './references.js'
import { dedupeSearchResults, ipPatternLinks, normalizeDoi, normalizeSearchResult } from './metadata.js'
import { buildOllamaPrompt, rewriteParagraph, summarizeChanges } from './rewriter.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function configFor(dataset, plotType, patch = {}) {
  const config = defaultConfig(dataset, { plotType, ...patch })
  if (['heatmap', 'contour', 'scatter3d', 'surface', 'mesh3d'].includes(plotType)) {
    const numeric = numericColumns(dataset)
    config.xKey = numeric[0]?.key || config.xKey
    config.yKeys = numeric[1] ? [numeric[1].key] : config.yKeys
    config.zKey = numeric[2]?.key || config.zKey
  }
  return normalizeConfig(config)
}

const TWO_D_TRACE_TYPES = {
  line: 'scatter', scatter: 'scatter', bar: 'bar', area: 'scatter', histogram: 'histogram',
  box: 'box', errorbar: 'scatter', heatmap: 'heatmap', contour: 'contour', spectrum: 'scatter'
}

const THREE_D_TYPES = ['scatter3d', 'surface', 'mesh3d']

/**
 * Inspect browser capabilities without failing the whole report when one is unavailable.
 * @returns {{blob: boolean, objectUrl: boolean, anchorDownload: boolean, browserStorage: boolean, webgl: boolean}}
 */
export function detectCapabilities() {
  const hasBlob = typeof Blob !== 'undefined'
  const hasObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
  let anchorDownload = false
  let webgl = false
  let browserStorage = false
  try {
    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a')
      anchorDownload = 'download' in anchor
      const canvas = document.createElement('canvas')
      webgl = Boolean(canvas.getContext?.('webgl') || canvas.getContext?.('experimental-webgl'))
    }
  } catch {
    /* headless or restricted browser */
  }
  try {
    browserStorage = typeof indexedDB !== 'undefined' || typeof localStorage !== 'undefined'
  } catch {
    browserStorage = false
  }
  return { blob: hasBlob, objectUrl: hasObjectUrl, anchorDownload, browserStorage, webgl }
}

function checkBrowserCapabilities(env) {
  const missing = Object.entries(env)
    .filter(([, available]) => !available)
    .map(([key]) => key)
  assert(!missing.length, `Unavailable in this browser: ${missing.join(', ')}.`)
  return 'Blob, object URLs, downloads, local storage and WebGL are available.'
}

function checkDataImport() {
  const parsed = parseDelimitedText('Time,Signal\n0,1.2\n1,2.4\n2,3.1\n', 'Feature test data')
  assert(parsed.dataset.rowCount === 3, 'CSV rows were not parsed.')
  assert(parsed.dataset.columns.length === 2, 'CSV columns were not detected.')
  assert(datasetToCSV(parsed.dataset).includes('Signal'), 'Dataset CSV export lost a column.')
  return `${parsed.dataset.rowCount} rows parsed and re-exported.`
}

function checkSyntheticLabel() {
  const sample = sampleEngineDataset()
  assert(sample.source === 'sample', 'Sample dataset is not marked as a sample.')
  assert(sample.warnings.some((warning) => /synthetic/i.test(warning)), 'Sample dataset lacks a synthetic-data warning.')
  return 'Sample data is explicitly labelled synthetic.'
}

function checkNumericDetection() {
  const dataset = buildDataset({
    name: 'Mixed columns',
    headers: ['X', 'Label', 'Y'],
    rows: [[1, 'batch A', 2], [2, 'batch B', 4]],
    source: 'manual'
  })
  const numeric = numericColumns(dataset)
  assert(numeric.map((column) => column.key).join(',') === 'c0,c2', 'Numeric/text column detection failed.')
  return 'Numeric and text columns separated correctly.'
}

function checkTwoDimensionalPlots() {
  const engine = sampleEngineDataset()
  const grid = sampleSurfaceDataset()
  for (const type of PLOT_TYPES) {
    const dataset = ['heatmap', 'contour'].includes(type.id) ? grid : engine
    const config = configFor(dataset, type.id)
    assert(validateConfig(dataset, config).errors.length === 0, `${type.label}: invalid configuration.`)
    const figure = buildPlotlyFigure(dataset, config)
    assert(figure.data.length > 0, `${type.label}: no trace generated.`)
    assert(figure.data[0].type === TWO_D_TRACE_TYPES[type.id], `${type.label}: expected ${TWO_D_TRACE_TYPES[type.id]}, got ${figure.data[0].type}.`)
  }
  return `All ${PLOT_TYPES.length} 2D plot types produced traces.`
}

function checkThreeDimensionalPlots() {
  const surface = sampleSurfaceDataset()
  for (const plotType of THREE_D_TYPES) {
    const config = configFor(surface, plotType)
    assert(validateConfig(surface, config).errors.length === 0, `${plotType}: invalid configuration.`)
    const figure = buildPlotlyFigure(surface, config)
    assert(figure.data.length === 1, `${plotType}: expected one trace.`)
    assert(figure.data[0].type === plotType, `${plotType}: unexpected trace type.`)
    assert(figure.layout.scene, `${plotType}: missing 3D scene layout.`)
  }
  return '3D scatter, surface and mesh scenes all build.'
}

function checkSurfaceQuality() {
  const surface = sampleSurfaceDataset()
  const base = configFor(surface, 'surface')
  const styled = buildPlotlyFigure(surface, normalizeConfig({
    ...base, surfaceContours: true, surfaceLighting: 'glossy', surfaceOpacity: 0.7
  }))
  const trace = styled.data[0]
  assert(trace.contours?.x?.show && trace.contours?.y?.show && trace.contours?.z?.show, 'Surface contour controls did not reach the trace.')
  assert(trace.opacity === 0.7, 'Surface opacity control did not reach the trace.')
  assert(trace.lighting?.specular > 0, 'Surface lighting preset did not reach the trace.')
  assert(Object.keys(LIGHTING_PRESETS).length >= 4, 'Lighting presets are missing.')
  const mesh = buildPlotlyFigure(surface, normalizeConfig({ ...configFor(surface, 'mesh3d'), surfaceLighting: 'flat' }))
  assert(mesh.data[0].flatshading === true, 'Flat mesh shading did not reach the trace.')
  return 'Contours, lighting presets and opacity applied to 3D traces.'
}

function checkFitLabel() {
  const dataset = sampleEngineDataset()
  const figure = buildPlotlyFigure(dataset, configFor(dataset, 'line'), {
    fitLabel: 'Linear fit<br>y = 1.2x + 3<br>R² = 0.95'
  })
  const label = (figure.layout.annotations || []).find((note) => String(note.text || '').includes('R²'))
  assert(label && label.xref === 'paper', 'The fit equation/R² label is not on the layout.')
  return 'Fit equation and R² annotation rendered on the chart.'
}

function checkErrorBars() {
  const dataset = buildDataset({
    name: 'Error series',
    headers: ['X', 'Y1', 'Y2', 'Err'],
    rows: [[0, 10, 100, 1], [1, 12, 101, 2], [2, 14, 104, 3]],
    source: 'manual'
  })
  const figure = buildPlotlyFigure(dataset, configFor(dataset, 'errorbar', { yKeys: ['c1', 'c2'], errorKey: 'c3' }))
  assert(figure.data.length === 2, 'Error-bar series were not built.')
  assert(figure.data[0].error_y?.array?.length === 3, 'Y error bars are missing values.')
  const horizontal = buildPlotlyFigure(dataset, configFor(dataset, 'scatter', { xErrorKey: 'c3' }))
  assert(horizontal.data[0].error_x?.array?.length === 3, 'X error bars are missing values.')
  return 'X/Y error bars align row-by-row across series.'
}

function checkStyleControls() {
  const engine = sampleEngineDataset()
  const figure = buildPlotlyFigure(engine, configFor(engine, 'line', {
    showGrid: false, reverseColorscale: true, lineShape: 'hv', showMarkers: false,
    refLines: [{ axis: 'y', value: 20 }], annotations: [{ text: 'Peak' }]
  }))
  assert(!figure.layout.xaxis.showgrid, 'Grid toggle was ignored.')
  assert(figure.data[0].line.shape === 'hv', 'Line shape was ignored.')
  assert(figure.data[0].mode === 'lines', 'Marker toggle was ignored.')
  assert(figure.layout.shapes?.length === 1 && figure.layout.annotations?.length >= 1, 'Reference line or annotation was ignored.')
  const heatmap = buildPlotlyFigure(sampleSurfaceDataset(), configFor(sampleSurfaceDataset(), 'heatmap', { reverseColorscale: true }))
  assert(heatmap.data[0].reversescale === true, 'Reverse colour scale was ignored.')
  return 'Grid, line shape, markers, annotations and colour scale respond.'
}

function checkBarHistogramBoxOptions() {
  const engine = sampleEngineDataset()
  for (const barMode of ['group', 'stack', 'relative', 'overlay']) {
    const figure = buildPlotlyFigure(engine, configFor(engine, 'bar', { barMode }))
    assert(figure.layout.barmode === barMode, `Bar mode ${barMode} was ignored.`)
  }
  const histogram = buildPlotlyFigure(engine, configFor(engine, 'histogram', { histogramBins: 12 }))
  assert(histogram.data[0].nbinsx === 12, 'Histogram bin control was ignored.')
  const box = buildPlotlyFigure(engine, configFor(engine, 'box', { boxPoints: 'all' }))
  assert(box.data[0].boxpoints === 'all', 'Box point mode was ignored.')
  return 'Bar modes, histogram bins and box point modes respond.'
}

function checkAnalysis() {
  const xs = [1, 2, 3, 4, 5, 6]
  const ys = [2.1, 3.9, 6.2, 8.1, 9.8, 12.2]
  const linear = linearRegression(xs, ys)
  const polynomial = polynomialRegression(xs, ys, 2)
  const fit = nonlinearFit('logarithmic', xs, ys)
  assert(Number.isFinite(linear.r2) && linear.r2 > 0.9, 'Linear regression did not fit a clear trend.')
  assert(Number.isFinite(polynomial.r2), 'Polynomial regression failed.')
  assert(fit.equation && !fit.error, `Non-linear fit failed: ${fit.error || 'no equation'}`)
  assert(Number.isFinite(pearson(xs, ys)) && Number.isFinite(spearman(xs, ys)), 'Correlation calculations failed.')
  assert(describe(ys).n === ys.length, 'Descriptive statistics failed.')
  assert(iqrOutliers([1, 2, 2, 3, 3, 4, 50]).indices.length > 0, 'IQR outlier detection failed.')
  const interpolation = linearInterpolate(xs, ys, 2.5)
  assert(!interpolation.error && Math.abs(interpolation.y - 5.05) < 1.2, 'Linear interpolation failed.')
  return 'Regression, correlation, statistics, outliers and interpolation respond.'
}

function checkReferences() {
  const reference = normalizeReference({
    type: 'article', title: 'A test article', authors: ['Curie, Marie', 'Bohr, Niels'],
    year: '2021', journal: 'Journal of Tests', doi: '10.1234/test.2021',
    url: 'https://doi.org/10.1234/test.2021'
  })
  for (const style of CITATION_STYLES) {
    assert(String(formatCitation(reference, style)).length > 5, `${style} citation formatting failed.`)
  }
  assert(exportBibTeX([reference]).includes('@article'), 'BibTeX export failed.')
  assert(dedupeReferences([reference, { ...reference, id: 'other' }]).length === 1, 'Reference deduplication failed.')
  assert(normalizeDoi('https://doi.org/10.1234/test.2021') === '10.1234/test.2021', 'DOI normalisation failed.')
  return `${CITATION_STYLES.length} citation styles, BibTeX and deduplication respond.`
}

function checkReferenceDiscoveryHelpers() {
  const first = normalizeSearchResult({ title: 'A paper', doi: '10.1/a', source: 'OpenAlex', isOa: true })
  const duplicate = normalizeSearchResult({ title: 'A paper', doi: 'https://doi.org/10.1/a', source: 'DOAJ', isOa: true })
  const unique = normalizeSearchResult({ title: 'Another paper', doi: '10.1/b', source: 'arXiv' })
  assert(dedupeSearchResults([first, duplicate, unique]).length === 2, 'Search result deduplication failed.')
  const links = ipPatternLinks('nickel catalyst')
  assert(links.patents.every((link) => link.href.includes('nickel') || link.href.includes('patentsview')), 'Patent links were not built from the query.')
  assert(links.patterns.every((link) => link.href.includes('nickel')), 'Pattern links were not built from the query.')
  return 'Metadata normalisation, deduplication and external IP/pattern links respond.'
}

function checkRewriter() {
  const text = 'It is important to note that the samples were analysed by the team in order to improve the result. The result is very good.'
  const rewritten = rewriteParagraph(text, { preset: 'concise' })
  assert(rewritten !== text, 'Local rewriting made no change to a wordy paragraph.')
  assert(!/in order to|it is important to note that/i.test(rewritten), 'Filler phrases survived rewriting.')
  const protectedText = rewriteParagraph('The value was 42.5 °C and the DOI is 10.1234/abc. See (Smith, 2020).', { preset: 'natural' })
  assert(protectedText.includes('42.5 °C'), 'Numbers/units were altered by rewriting.')
  assert(protectedText.includes('10.1234/abc'), 'DOIs were altered by rewriting.')
  assert(protectedText.includes('(Smith, 2020)'), 'Citations were altered by rewriting.')
  const changes = summarizeChanges(text, rewritten)
  assert(changes.fillersRemoved >= 1, 'Rewrite summary did not detect filler removal.')
  assert(buildOllamaPrompt(text, 'academic').includes('Preserve all numbers'), 'Ollama prompt lost safety instructions.')
  return 'Local rewriting protects numbers, units, DOIs and citations.'
}

function checkPublicationDefaults() {
  const dataset = sampleEngineDataset()
  const config = defaultConfig(dataset)
  const figure = buildPlotlyFigure(dataset, config)
  assert(config.width >= 1000 && config.height >= 600, 'Export canvas defaults are below publication size.')
  assert(figure.layout.xaxis.showline && figure.layout.xaxis.layer === 'belowTraces', 'Publication axis styling is missing.')
  assert(figure.layout.hoverlabel?.bordercolor, 'Hover styling is missing.')
  assert(figure.layout.legend?.borderwidth === 1, 'Legend styling is missing.')
  return '1000×620 canvas, clean axes, hover labels and legend frame active.'
}

function checkConfigRoundTrip() {
  const dataset = sampleSurfaceDataset()
  const config = normalizeConfig({
    ...defaultConfig(dataset, { plotType: 'surface' }),
    surfaceContours: true, surfaceLighting: 'matte', surfaceOpacity: 0.6,
    hiddenSeries: ['c1']
  })
  const restored = normalizeConfig(JSON.parse(JSON.stringify(config)))
  assert(restored.surfaceContours === true && restored.surfaceLighting === 'matte' && restored.surfaceOpacity === 0.6, '3D quality settings did not survive config JSON round-trip.')
  assert(restored.hiddenSeries?.includes('c1'), 'Hidden series did not survive config round-trip.')
  return 'Graph configurations round-trip through JSON, including 3D quality settings.'
}

const TESTS = [
  { id: 'csv-import', group: 'Data', name: 'CSV import and export', run: checkDataImport },
  { id: 'numeric-columns', group: 'Data', name: 'Numeric column detection', run: checkNumericDetection },
  { id: 'synthetic-label', group: 'Data', name: 'Synthetic sample labelling', run: checkSyntheticLabel },
  { id: 'plot-types-2d', group: '2D graphs', name: 'All 10 2D plot types', run: checkTwoDimensionalPlots },
  { id: 'plot-types-3d', group: '3D graphs', name: 'All 3 3D plot modes', run: checkThreeDimensionalPlots },
  { id: 'error-bars', group: '2D graphs', name: 'X/Y error bars', run: checkErrorBars },
  { id: 'style-controls', group: '2D graphs', name: 'Grid, line, annotation and colour controls', run: checkStyleControls },
  { id: 'bar-hist-box', group: '2D graphs', name: 'Bar, histogram and box options', run: checkBarHistogramBoxOptions },
  { id: 'fit-label', group: 'Analysis', name: 'Fit equation and R² on chart', run: checkFitLabel },
  { id: 'analysis', group: 'Analysis', name: 'Statistics, fit and interpolation', run: checkAnalysis },
  { id: 'surface-quality', group: '3D graphs', name: 'Contours, lighting and opacity', run: checkSurfaceQuality },
  { id: 'publication-defaults', group: 'Graph quality', name: 'Publication-ready defaults', run: checkPublicationDefaults },
  { id: 'config-roundtrip', group: 'Graph quality', name: 'Config JSON round-trip', run: checkConfigRoundTrip },
  { id: 'citations', group: 'Library', name: 'Citation styles and BibTeX', run: checkReferences },
  { id: 'discovery-helpers', group: 'Library', name: 'Reference discovery helpers', run: checkReferenceDiscoveryHelpers },
  { id: 'rewriter', group: 'Text lab', name: 'Local paragraph rewriting safety', run: checkRewriter },
  { id: 'browser-capabilities', group: 'Environment', name: 'Export and 3D browser support', run: (env) => checkBrowserCapabilities(env) }
]

/**
 * Run every in-app check. Failures are reported, never thrown, so the UI can show a full report.
 * @param {{environment?: ReturnType<typeof detectCapabilities>}} [options]
 */
export function runFeatureTests(options = {}) {
  const environment = options.environment || detectCapabilities()
  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now()
  const results = TESTS.map((test) => {
    const started = now()
    try {
      const detail = test.run(environment)
      return { id: test.id, group: test.group, name: test.name, status: 'pass', detail, durationMs: Math.max(0, Math.round((now() - started) * 100) / 100) }
    } catch (error) {
      return {
        id: test.id, group: test.group, name: test.name, status: 'fail',
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Math.max(0, Math.round((now() - started) * 100) / 100)
      }
    }
  })
  const passed = results.filter((result) => result.status === 'pass').length
  return {
    ranAt: new Date().toISOString(),
    environment,
    results,
    summary: { total: results.length, passed, failed: results.length - passed }
  }
}

export const FEATURE_TEST_GROUPS = [...new Set(TESTS.map((test) => test.group))]
