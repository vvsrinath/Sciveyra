import { describe, expect, it } from 'vitest'
import { buildDataset } from '../src/lib/parse.js'
import {
  buildPlotlyFigure, columnName, defaultConfig, hexToRgba, normalizeConfig, validateConfig
} from '../src/lib/graphConfig.js'

const dataset = buildDataset({
  name: 'Example dataset',
  headers: ['Time', 'Signal', 'Replicate'],
  rows: [[0, 1, 1.1], [1, 2, 2.1], [2, 4, 4.1], [3, 8, 8.1]],
  source: 'manual'
})

describe('defaultConfig', () => {
  it('chooses numeric columns and sensible defaults', () => {
    const config = defaultConfig(dataset)
    expect(config.xKey).toBe('c0')
    expect(config.yKeys).toEqual(['c1'])
    expect(config.zKey).toBe('c2')
    expect(config.plotType).toBe('line')
    expect(config.width).toBe(1000)
    expect(config.height).toBe(620)
    expect(config.fontFamily).toBe('DM Sans')
  })

  it('sanitizes invalid numeric and style options', () => {
    const config = normalizeConfig({ width: 99999, height: 'x', fontSize: 'bad', markerShape: 'weird', lineDash: 'zigzag', colors: [] })
    expect(config.width).toBe(4000)
    expect(config.height).toBe(620)
    expect(config.fontSize).toBe(13)
    expect(config.markerShape).toBe('circle')
    expect(config.lineDash).toBe('solid')
    expect(config.colors.length).toBeGreaterThan(0)
    expect(config.surfaceContours).toBe(false)
    expect(config.surfaceLighting).toBe('soft')
    expect(config.surfaceOpacity).toBe(1)
  })
})

describe('validateConfig', () => {
  it('accepts a valid default configuration', () => {
    const config = defaultConfig(dataset)
    expect(validateConfig(dataset, config).errors).toEqual([])
  })

  it('rejects missing datasets, columns and incompatible keys', () => {
    expect(validateConfig(null, defaultConfig(dataset)).errors).toContain('No dataset is selected.')
    const config = defaultConfig(dataset)
    config.yKeys = ['does-not-exist']
    expect(validateConfig(dataset, config).errors.some((error) => error.includes('no longer numeric'))).toBe(true)
  })

  it('warns about log scales and negative error columns', () => {
    const withError = buildDataset({
      name: 'Errors',
      headers: ['X', 'Y', 'Err'],
      rows: [[0, -1, -0.5], [1, 2, 1], [2, 3, 1]],
      source: 'manual'
    })
    const config = defaultConfig(withError)
    config.errorKey = 'c2'
    config.logX = true
    config.logY = true
    const { warnings } = validateConfig(withError, config)
    expect(warnings.some((warning) => warning.includes('negative'))).toBe(true)
    expect(warnings.some((warning) => warning.includes('Log X'))).toBe(true)
    expect(warnings.some((warning) => warning.includes('Log Y'))).toBe(true)
  })
})

describe('buildPlotlyFigure', () => {
  it('builds a line chart with a trace per selected Y column', () => {
    const config = defaultConfig(dataset)
    const figure = buildPlotlyFigure(dataset, config)
    expect(figure.data).toHaveLength(1)
    expect(figure.data[0].type).toBe('scatter')
    expect(figure.data[0].mode).toBe('lines+markers')
    expect(figure.data[0].x).toEqual([0, 1, 2, 3])
    expect(figure.data[0].y).toEqual([1, 2, 4, 8])
    expect(figure.layout.title.text).toBe('Example dataset')
  })

  it('builds bar and histogram traces', () => {
    const bar = buildPlotlyFigure(dataset, { ...defaultConfig(dataset), plotType: 'bar' })
    expect(bar.data[0].type).toBe('bar')
    expect(bar.layout.barmode).toBe('group')
    const histogram = buildPlotlyFigure(dataset, { ...defaultConfig(dataset), plotType: 'histogram' })
    expect(histogram.data[0].type).toBe('histogram')
  })

  it('returns an empty figure when the configuration is invalid', () => {
    const figure = buildPlotlyFigure(null, defaultConfig(null))
    expect(figure.data).toEqual([])
    expect(figure.layout).toBeTruthy()
  })

  it('adds reference lines and annotations to the layout', () => {
    const config = {
      ...defaultConfig(dataset),
      refLines: [{ axis: 'y', value: 2, color: '#ff0000' }],
      annotations: [{ text: 'Peak', x: 1, y: 2 }]
    }
    const figure = buildPlotlyFigure(dataset, config)
    expect(figure.layout.shapes).toHaveLength(1)
    expect(figure.layout.annotations[0].text).toBe('Peak')
  })

  it('places fit equation and R² labels on the chart', () => {
    const figure = buildPlotlyFigure(dataset, defaultConfig(dataset), {
      fitLabel: 'Linear fit<br>y = 2.0x + 1.0<br>R² = 0.9876'
    })
    const label = figure.layout.annotations.find((annotation) => String(annotation.text).includes('R²'))
    expect(label).toBeTruthy()
    expect(label.xref).toBe('paper')
    expect(label.yref).toBe('paper')
    expect(label.showarrow).toBe(false)
    expect(label.text).toContain('y = 2.0x + 1.0')
  })

  it('uses publication-style axis and legend defaults', () => {
    const figure = buildPlotlyFigure(dataset, defaultConfig(dataset))
    expect(figure.layout.xaxis.showline).toBe(true)
    expect(figure.layout.xaxis.layer).toBe('belowTraces')
    expect(figure.layout.xaxis.zeroline).toBe(false)
    expect(figure.layout.hoverlabel.bordercolor).toBeTruthy()
    expect(figure.layout.legend.borderwidth).toBe(1)
    expect(figure.layout.separators).toBe('.,')
  })
})

describe('graph helpers', () => {
  it('resolves column names and converts colours', () => {
    expect(columnName(dataset, 'c1')).toBe('Signal')
    expect(columnName(dataset, 'missing')).toBe('missing')
    expect(hexToRgba('#3779f6', 0.5)).toBe('rgba(55,121,246,0.5)')
  })
})
