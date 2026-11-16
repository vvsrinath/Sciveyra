import { describe, expect, it } from 'vitest'
import { buildDataset } from '../src/lib/parse.js'
import { sampleEngineDataset, sampleSurfaceDataset } from '../src/lib/sampleData.js'
import {
  buildPlotlyFigure, defaultConfig, normalizeConfig, validateConfig
} from '../src/lib/graphConfig.js'

const engine = sampleEngineDataset()
const surface = sampleSurfaceDataset()

const series = buildDataset({
  name: 'Multi-series errors',
  headers: ['X', 'Y1', 'Y2', 'Err'],
  rows: [
    [0, 10, 100, 1],
    [1, null, 101, 2],
    [1, 12, null, 5],
    [2, 14, 104, 3]
  ],
  source: 'manual'
})

const grid = buildDataset({
  name: 'Grid',
  headers: ['X', 'Y', 'Z'],
  rows: [
    [0, 0, 1], [1, 0, 2], [2, 0, 3],
    [0, 1, 4], [1, 1, 5], [2, 1, 6],
    [0, 2, 7], [1, 2, 8], [2, 2, 9]
  ],
  source: 'manual'
})

function configFor(dataset, patch = {}) {
  return normalizeConfig({ ...defaultConfig(dataset), ...patch })
}

describe('every 2D plot type builds a usable figure', () => {
  const expected = {
    line: 'scatter',
    scatter: 'scatter',
    bar: 'bar',
    area: 'scatter',
    histogram: 'histogram',
    box: 'box',
    errorbar: 'scatter',
    heatmap: 'heatmap',
    contour: 'contour',
    spectrum: 'scatter'
  }

  for (const [plotType, traceType] of Object.entries(expected)) {
    it(`builds a ${plotType} trace`, () => {
      const dataset = ['heatmap', 'contour'].includes(plotType) ? grid : engine
      const config = configFor(dataset, { plotType })
      const { errors } = validateConfig(dataset, config)
      const figure = buildPlotlyFigure(dataset, config)
      expect(errors).toEqual([])
      expect(figure.data.length).toBeGreaterThan(0)
      expect(figure.data[0].type).toBe(traceType)
      expect(figure.layout).toBeTruthy()
    })
  }

  it('gives line charts a line shape and optional markers', () => {
    const line = buildPlotlyFigure(engine, configFor(engine, { plotType: 'line' }))
    expect(line.data[0].line.shape).toBe('linear')
    expect(line.data[0].mode).toBe('lines+markers')
    const noMarkers = buildPlotlyFigure(engine, configFor(engine, { plotType: 'line', showMarkers: false }))
    expect(noMarkers.data[0].mode).toBe('lines')
  })

  it('fills area charts to the zero baseline', () => {
    const area = buildPlotlyFigure(engine, configFor(engine, { plotType: 'area' }))
    expect(area.data[0].fill).toBe('tozeroy')
  })

  it('builds heatmap and contour grids from X, Y and Z', () => {
    for (const plotType of ['heatmap', 'contour']) {
      const figure = buildPlotlyFigure(grid, configFor(grid, { plotType }))
      expect(figure.data[0].x).toEqual([0, 1, 2])
      expect(figure.data[0].y).toEqual([0, 1, 2])
      expect(figure.data[0].z).toHaveLength(3)
      expect(figure.data[0].z[0]).toEqual([1, 2, 3])
    }
    const contour = buildPlotlyFigure(grid, configFor(grid, { plotType: 'contour' }))
    expect(contour.data[0].contours.showlabels).toBe(true)
  })
})

describe('every 3D plot type builds a usable figure', () => {
  for (const plotType of ['surface', 'mesh3d', 'scatter3d']) {
    it(`builds a ${plotType} trace`, () => {
      const config = configFor(surface, { plotType })
      const { errors } = validateConfig(surface, config)
      const figure = buildPlotlyFigure(surface, config)
      expect(errors).toEqual([])
      expect(figure.data).toHaveLength(1)
      expect(figure.data[0].type).toBe(plotType)
      expect(figure.layout.scene).toBeTruthy()
    })
  }

  it('renders a complete 11 x 11 surface grid', () => {
    const figure = buildPlotlyFigure(surface, configFor(surface, { plotType: 'surface' }))
    expect(figure.data[0].x).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(figure.data[0].y).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(figure.data[0].z).toHaveLength(11)
    figure.data[0].z.forEach((row) => expect(row).toHaveLength(11))
  })

  it('honours the showGrid toggle on every scene axis', () => {
    for (const showGrid of [true, false]) {
      const figure = buildPlotlyFigure(surface, configFor(surface, { plotType: 'surface', showGrid }))
      expect(figure.layout.scene.xaxis.showgrid).toBe(showGrid)
      expect(figure.layout.scene.yaxis.showgrid).toBe(showGrid)
      expect(figure.layout.scene.zaxis.showgrid).toBe(showGrid)
    }
  })

  it('honours reverseColorscale in all 3D modes', () => {
    const surfaceFigure = buildPlotlyFigure(surface, configFor(surface, { plotType: 'surface', reverseColorscale: true }))
    expect(surfaceFigure.data[0].reversescale).toBe(true)

    const mesh = buildPlotlyFigure(surface, configFor(surface, { plotType: 'mesh3d', reverseColorscale: true }))
    expect(mesh.data[0].reversescale).toBe(true)

    const scatter = buildPlotlyFigure(surface, configFor(surface, { plotType: 'scatter3d', reverseColorscale: true }))
    expect(scatter.data[0].marker.reversescale).toBe(true)
  })

  it('builds valid mesh3d triangles', () => {
    const figure = buildPlotlyFigure(surface, configFor(surface, { plotType: 'mesh3d' }))
    expect(figure.data[0].i.length).toBeGreaterThan(0)
    expect(figure.data[0].i).toHaveLength(figure.data[0].j.length)
    expect(figure.data[0].i).toHaveLength(figure.data[0].k.length)
  })
})

describe('error bars', () => {
  it('aligns Y errors row-by-row for each series', () => {
    const config = configFor(series, { plotType: 'errorbar', yKeys: ['c1', 'c2'], errorKey: 'c3' })
    const figure = buildPlotlyFigure(series, config)
    expect(figure.data).toHaveLength(2)
    expect(figure.data[0].error_y.array).toEqual([1, 5, 3])
    expect(figure.data[1].error_y.array).toEqual([1, 2, 3])
  })

  it('adds horizontal X error bars from the X error column', () => {
    const config = configFor(engine, { plotType: 'scatter', errorKey: 'c3', xErrorKey: 'c3' })
    const figure = buildPlotlyFigure(engine, config)
    expect(figure.data[0].error_y.array.length).toBe(figure.data[0].x.length)
    expect(figure.data[0].error_x.array.length).toBe(figure.data[0].x.length)
    expect(figure.data[0].error_x.symmetric).toBe(true)
  })

  it('ignores negative and missing error magnitudes', () => {
    const withNegatives = buildDataset({
      name: 'Bad errors',
      headers: ['X', 'Y', 'Err'],
      rows: [[0, 1, -2], [1, 2, 0.5], [2, 3, null], [3, 4, 1]],
      source: 'manual'
    })
    const config = configFor(withNegatives, { errorKey: 'c2' })
    const figure = buildPlotlyFigure(withNegatives, config)
    expect(figure.data[0].error_y.array).toEqual([null, 0.5, null, 1])
  })

  it('warns when the X error column is missing or negative', () => {
    const config = configFor(series, { xErrorKey: 'does-not-exist' })
    expect(validateConfig(series, config).errors.some((error) => error.includes('X error column'))).toBe(true)

    const withNegative = buildDataset({
      name: 'Negative X errors',
      headers: ['X', 'Y', 'XErr'],
      rows: [[0, 1, -1], [1, 2, 1]],
      source: 'manual'
    })
    const check = configFor(withNegative, { xErrorKey: 'c2' })
    expect(validateConfig(withNegative, check).warnings.some((warning) => warning.includes('X error column contains negative'))).toBe(true)
  })
})

describe('SigmaPlot-style options', () => {
  it('applies bar modes and gap', () => {
    for (const barMode of ['group', 'stack', 'relative', 'overlay']) {
      const figure = buildPlotlyFigure(engine, configFor(engine, { plotType: 'bar', barMode, bargap: 0.35 }))
      expect(figure.layout.barmode).toBe(barMode)
      expect(figure.layout.bargap).toBe(0.35)
    }
  })

  it('applies histogram bin counts', () => {
    const figure = buildPlotlyFigure(engine, configFor(engine, { plotType: 'histogram', histogramBins: 12 }))
    expect(figure.data[0].nbinsx).toBe(12)
    const auto = buildPlotlyFigure(engine, configFor(engine, { plotType: 'histogram', histogramBins: 0 }))
    expect(auto.data[0].nbinsx).toBeUndefined()
  })

  it('applies box point display modes', () => {
    for (const boxPoints of ['all', 'outliers', 'suspectedoutliers', 'none']) {
      const figure = buildPlotlyFigure(engine, configFor(engine, { plotType: 'box', boxPoints }))
      expect(figure.data[0].boxpoints).toBe(boxPoints)
    }
  })

  it('applies line shapes and smoothing', () => {
    for (const lineShape of ['linear', 'hv', 'vh', 'hvh']) {
      const figure = buildPlotlyFigure(engine, configFor(engine, { plotType: 'line', lineShape }))
      expect(figure.data[0].line.shape).toBe(lineShape)
    }
    const smooth = buildPlotlyFigure(engine, configFor(engine, { plotType: 'line', lineShape: 'hv', smoothing: true }))
    expect(smooth.data[0].line.shape).toBe('spline')
  })

  it('hides selected series with legend-only visibility', () => {
    const figure = buildPlotlyFigure(engine, configFor(engine, { yKeys: ['c1', 'c2'], hiddenSeries: ['c2'] }))
    expect(figure.data[1].visible).toBe('legendonly')
  })

  it('normalizes invalid SigmaPlot options safely', () => {
    const config = normalizeConfig({ barMode: 'nope', boxPoints: 'nope', lineShape: 'nope', histogramBins: 9999 })
    expect(config.barMode).toBe('group')
    expect(config.boxPoints).toBe('outliers')
    expect(config.lineShape).toBe('linear')
    expect(config.histogramBins).toBe(200)
  })
})

describe('plot validation edge cases', () => {
  it('requires a Y column for heatmap and contour grids', () => {
    for (const plotType of ['heatmap', 'contour']) {
      const config = configFor(grid, { plotType, yKeys: [] })
      expect(validateConfig(grid, config).errors.some((error) => error.includes('Y column for the grid rows'))).toBe(true)
      expect(buildPlotlyFigure(grid, config).data).toEqual([])
    }
  })

  it('requires X, Y and Z for 3D plots', () => {
    const missingY = configFor(surface, { plotType: 'surface', yKeys: [] })
    expect(validateConfig(surface, missingY).errors.some((error) => error.includes('Y column'))).toBe(true)
    const missingZ = configFor(surface, { plotType: 'surface', zKey: '' })
    expect(validateConfig(surface, missingZ).errors.some((error) => error.includes('Z column'))).toBe(true)
    const scatterMissingZ = configFor(surface, { plotType: 'scatter3d', zKey: '' })
    expect(validateConfig(surface, scatterMissingZ).errors.some((error) => error.includes('3D scatter points'))).toBe(true)
  })

  it('does not require an X column for histograms or box plots', () => {
    const histogram = configFor(engine, { plotType: 'histogram', xKey: '' })
    expect(validateConfig(engine, histogram).errors).toEqual([])
  })
})
