import { columnValues, numericColumns, pairedValues } from './parse.js'

export const PALETTE = [
  '#3779f6', '#e8590c', '#0ca678', '#9c36b5', '#f08c00',
  '#1098ad', '#d6336c', '#5c7cfa', '#2b8a3e', '#862e9c'
]

export const COLORSCALES = {
  Viridis: [[0, '#440154'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']],
  Plasma: [[0, '#0d0887'], [0.25, '#7e03a8'], [0.5, '#cc4778'], [0.75, '#f89540'], [1, '#f0f921']],
  Ocean: [[0, '#081d58'], [0.33, '#225ea8'], [0.66, '#41b6c4'], [1, '#c7e9b4']],
  Grayscale: [[0, '#111827'], [1, '#f9fafb']],
  Spectrum: [[0, '#313695'], [0.2, '#4575b4'], [0.4, '#74add1'], [0.6, '#fee090'], [0.8, '#f46d43'], [1, '#a50026']]
}

export const PLOT_TYPES = [
  { id: 'line', label: 'Line' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'bar', label: 'Bar' },
  { id: 'area', label: 'Area' },
  { id: 'histogram', label: 'Histogram' },
  { id: 'box', label: 'Box plot' },
  { id: 'errorbar', label: 'Error bars' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'contour', label: 'Contour' },
  { id: 'spectrum', label: 'Spectrum' }
]

export const MARKER_SHAPES = ['circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'triangle-down', 'star']
export const FONTS = ['DM Sans', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @param {Partial<import('../types').GraphConfig>} [overrides]
 * @returns {import('../types').GraphConfig}
 */
export function defaultConfig(dataset, overrides = {}) {
  const numeric = numericColumns(dataset)
  const xKey = numeric[0]?.key || ''
  const yKey = numeric[1]?.key || numeric[0]?.key || ''
  const zKey = numeric[2]?.key || ''
  const xName = numeric[0]?.name || 'X'
  const yName = numeric[1]?.name || 'Y'
  return normalizeConfig({
    plotType: 'line',
    xKey,
    yKeys: yKey ? [yKey] : [],
    secondaryYKeys: [],
    errorKey: '',
    xErrorKey: '',
    zKey,
    xLabel: xName,
    yLabel: yName,
    y2Label: '',
    title: dataset?.name || 'Untitled graph',
    xMin: '', xMax: '', yMin: '', yMax: '', y2Min: '', y2Max: '',
    logX: false, logY: false, logY2: false,
    showGrid: true, gridColor: '#e9eef5',
    showMinorTicks: false,
    tickFormat: '',
    fontFamily: 'DM Sans',
    fontSize: 13,
    lineWidth: 2.5,
    lineDash: 'solid',
    markerShape: 'circle',
    markerSize: 7,
    showMarkers: true,
    showLegend: true,
    legendPosition: 'top-right',
    colors: PALETTE,
    background: '#ffffff',
    plotBackground: '#ffffff',
    colorscale: 'Viridis',
    reverseColorscale: false,
    width: 900,
    height: 560,
    smoothing: false,
    lineShape: 'linear',
    bargap: 0.2,
    barMode: 'group',
    histogramBins: 0,
    boxPoints: 'outliers',
    annotations: [],
    refLines: [],
    ...overrides
  })
}

/**
 * @param {Partial<import('../types').GraphConfig>} [input]
 * @returns {import('../types').GraphConfig}
 */
export function normalizeConfig(input = {}) {
  const config = { ...input }
  const numeric = (value, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }
  config.plotType = PLOT_TYPES.some((type) => type.id === config.plotType) || ['scatter3d', 'surface', 'mesh3d'].includes(config.plotType)
    ? config.plotType
    : 'line'
  config.yKeys = Array.isArray(config.yKeys) ? config.yKeys.filter(Boolean) : []
  config.secondaryYKeys = Array.isArray(config.secondaryYKeys) ? config.secondaryYKeys.filter(Boolean) : []
  config.fontSize = numeric(config.fontSize, 13)
  config.lineWidth = numeric(config.lineWidth, 2.5)
  config.markerSize = numeric(config.markerSize, 7)
  config.bargap = numeric(config.bargap, 0.2)
  config.histogramBins = Math.max(0, Math.min(200, Math.round(numeric(config.histogramBins, 0))))
  config.width = Math.max(320, Math.min(4000, numeric(config.width, 900)))
  config.height = Math.max(240, Math.min(4000, numeric(config.height, 560)))
  if (!['group', 'stack', 'relative', 'overlay'].includes(config.barMode)) config.barMode = 'group'
  if (!['all', 'outliers', 'suspectedoutliers', 'none'].includes(config.boxPoints)) config.boxPoints = 'outliers'
  if (!['linear', 'spline', 'hv', 'vh', 'hvh'].includes(config.lineShape)) config.lineShape = 'linear'
  config.annotations = Array.isArray(config.annotations) ? config.annotations : []
  config.refLines = Array.isArray(config.refLines) ? config.refLines : []
  config.colors = Array.isArray(config.colors) && config.colors.length ? config.colors : PALETTE
  config.gridColor = config.gridColor || '#e9eef5'
  config.fontFamily = FONTS.includes(config.fontFamily) ? config.fontFamily : 'DM Sans'
  config.markerShape = MARKER_SHAPES.includes(config.markerShape) ? config.markerShape : 'circle'
  if (!['solid', 'dot', 'dash', 'longdash', 'dashdot'].includes(config.lineDash)) config.lineDash = 'solid'
  return config
}

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @param {import('../types').GraphConfig} config
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateConfig(dataset, config) {
  const errors = []
  const warnings = []
  if (!dataset) {
    errors.push('No dataset is selected.')
    return { errors, warnings }
  }
  const numeric = numericColumns(dataset)
  const keys = new Set(numeric.map((column) => column.key))
  if (!keys.has(config.xKey) && !['histogram', 'box'].includes(config.plotType)) {
    errors.push('Choose a numeric X column.')
  }
  if (!config.yKeys.length && !['heatmap', 'contour', 'surface', 'mesh3d'].includes(config.plotType)) {
    errors.push('Choose at least one numeric Y column.')
  }
  for (const key of [...config.yKeys, ...config.secondaryYKeys]) {
    if (!keys.has(key)) errors.push('A selected Y column is no longer numeric or was removed.')
  }
  if (config.errorKey && !keys.has(config.errorKey)) errors.push('The selected error column is not numeric or was removed.')
  if (config.xErrorKey && !keys.has(config.xErrorKey)) errors.push('The selected X error column is not numeric or was removed.')
  if (['heatmap', 'contour', 'surface', 'mesh3d'].includes(config.plotType)) {
    if (!keys.has(config.xKey)) errors.push('Choose a numeric X column for the grid.')
    if (!keys.has(config.yKeys[0])) errors.push('Choose a numeric Y column for the grid rows.')
    if (!keys.has(config.zKey)) errors.push('Choose a numeric Z column for the grid values.')
  }
  if (config.plotType === 'scatter3d' && !keys.has(config.zKey)) {
    errors.push('Choose a numeric Z column for the 3D scatter points.')
  }
  if (config.errorKey) {
    const xValues = columnValues(dataset, config.xKey)
    const errorValues = columnValues(dataset, config.errorKey)
    const usable = errorValues.filter((value) => value !== null)
    if (!usable.length) warnings.push('The error column has no numeric values, so error bars may be hidden.')
    if (usable.some((value) => value < 0)) warnings.push('The error column contains negative values. Error magnitudes should be positive.')
    if (xValues.length !== errorValues.length) warnings.push('The error column and X column have different lengths.')
  }
  if (config.xErrorKey) {
    const errorValues = columnValues(dataset, config.xErrorKey)
    const usable = errorValues.filter((value) => value !== null)
    if (!usable.length) warnings.push('The X error column has no numeric values, so horizontal error bars may be hidden.')
    if (usable.some((value) => value < 0)) warnings.push('The X error column contains negative values. Error magnitudes should be positive.')
  }
  if (config.logX) {
    const values = columnValues(dataset, config.xKey).filter((value) => value !== null)
    if (values.some((value) => value <= 0)) warnings.push('Log X scale hides non-positive X values. Filter or replace them first.')
  }
  if ((config.logY || config.logY2) && config.yKeys.length) {
    const values = config.yKeys.flatMap((key) => columnValues(dataset, key)).filter((value) => value !== null)
    if (values.some((value) => value <= 0)) warnings.push('Log Y scale hides non-positive Y values. Filter or replace them first.')
  }
  return { errors, warnings }
}

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @param {import('../types').GraphConfig} inputConfig
 * @param {{dark?: boolean, extraTraces?: any[]}} [options]
 * @returns {{data: any[], layout: any}}
 */
export function buildPlotlyFigure(dataset, inputConfig, { dark = false, extraTraces = [] } = {}) {
  const config = normalizeConfig(inputConfig)
  const { errors } = validateConfig(dataset, config)
  if (!dataset || errors.length) return { data: [], layout: baseLayout(config, dark) }
  if (['scatter3d', 'surface', 'mesh3d'].includes(config.plotType)) {
    return build3DFigure(dataset, config, { dark })
  }
  const data = []
  const type = config.plotType
  const yKeys = config.yKeys
  if (type === 'heatmap' || type === 'contour') {
    const grid = pivotGrid(dataset, config.xKey, config.yKeys[0], config.zKey)
    if (grid) {
      data.push({
        type: type === 'contour' ? 'contour' : 'heatmap',
        x: grid.x,
        y: grid.y,
        z: grid.z,
        colorscale: colorScale(config),
        reversescale: !!config.reverseColorscale,
        colorbar: { title: { text: columnName(dataset, config.zKey) } },
        hovertemplate: `${columnName(dataset, config.xKey)}: %{x}<br>${columnName(dataset, config.yKeys[0])}: %{y}<br>${columnName(dataset, config.zKey)}: %{z}<extra></extra>`
      })
      if (type === 'contour') data[0].contours = { coloring: 'heatmap', showlabels: true }
    }
  } else if (type === 'histogram') {
    yKeys.forEach((yKey, index) => {
      data.push({
        type: 'histogram',
        x: columnValues(dataset, yKey),
        name: columnName(dataset, yKey),
        nbinsx: config.histogramBins > 0 ? config.histogramBins : undefined,
        marker: { color: config.colors[index % config.colors.length], line: { color: config.background, width: 1 } },
        opacity: 0.85,
        visible: config.hiddenSeries?.includes(yKey) ? 'legendonly' : true,
        hovertemplate: `${columnName(dataset, yKey)}: %{x}<br>Count: %{y}<extra></extra>`
      })
    })
  } else if (type === 'box') {
    yKeys.forEach((yKey, index) => {
      data.push({
        type: 'box',
        y: columnValues(dataset, yKey),
        name: columnName(dataset, yKey),
        boxpoints: config.boxPoints,
        marker: { color: config.colors[index % config.colors.length], size: config.markerSize },
        line: { width: 1.5 },
        fillcolor: hexToRgba(config.colors[index % config.colors.length], 0.24),
        visible: config.hiddenSeries?.includes(yKey) ? 'legendonly' : true
      })
    })
  } else {
    yKeys.forEach((yKey, index) => {
      const { xs, ys } = pairedValues(dataset, config.xKey, yKey)
      const onSecondary = config.secondaryYKeys.includes(yKey)
      const color = config.colors[index % config.colors.length]
      const trace = {
        name: columnName(dataset, yKey),
        x: xs,
        y: ys,
        yaxis: onSecondary ? 'y2' : 'y',
        hovertemplate: `${columnName(dataset, config.xKey)}: %{x}<br>${columnName(dataset, yKey)}: %{y}<extra></extra>`,
        visible: config.hiddenSeries?.includes(yKey) ? 'legendonly' : true
      }
      if (type === 'bar') {
        Object.assign(trace, {
          type: 'bar',
          marker: { color: color, line: { color, width: 0.5 } },
          opacity: 0.9
        })
        if (config.errorKey || config.xErrorKey) attachErrors(trace, dataset, config, yKey)
      } else {
        Object.assign(trace, {
          type: 'scatter',
          mode: type === 'line' || type === 'area' || type === 'spectrum' || type === 'errorbar'
            ? (config.showMarkers ? 'lines+markers' : 'lines')
            : 'markers',
          line: {
            color,
            width: type === 'spectrum' ? Math.max(1, config.lineWidth - 0.7) : config.lineWidth,
            dash: config.lineDash,
            shape: config.smoothing ? 'spline' : config.lineShape
          },
          marker: {
            color,
            size: type === 'scatter' || type === 'errorbar' ? config.markerSize : Math.max(3, config.markerSize - 2),
            symbol: config.markerShape,
            line: { color: config.plotBackground, width: 1 }
          }
        })
        if (type === 'area') {
          trace.fill = 'tozeroy'
          trace.fillcolor = hexToRgba(color, 0.16)
        }
        if ((config.errorKey || config.xErrorKey) && (type === 'errorbar' || type === 'line' || type === 'scatter' || type === 'spectrum')) {
          attachErrors(trace, dataset, config, yKey)
        }
      }
      data.push(trace)
    })
  }
  const layout = baseLayout(config, dark)
  if (type === 'bar') {
    layout.barmode = config.barMode
    layout.bargap = config.bargap
  }
  if (type === 'heatmap' || type === 'contour') {
    layout.xaxis.title.text = config.xLabel || columnName(dataset, config.xKey)
    layout.yaxis.title.text = config.yLabel || columnName(dataset, config.yKeys[0])
  }
  if (type === 'histogram') {
    layout.barmode = 'overlay'
    layout.xaxis.title.text = config.xLabel || yKeys.map((key) => columnName(dataset, key)).join(' / ')
    layout.yaxis.title.text = config.yLabel || 'Count'
  }
  layout.shapes = referenceShapes(config, dataset)
  layout.annotations = chartAnnotations(config)
  return { data: [...data, ...extraTraces], layout }
}

function attachErrors(trace, dataset, config, yKey) {
  const yErrors = []
  const xErrors = []
  for (const row of dataset?.rows || []) {
    const x = typeof row[config.xKey] === 'number' && Number.isFinite(row[config.xKey]) ? row[config.xKey] : null
    const y = typeof row[yKey] === 'number' && Number.isFinite(row[yKey]) ? row[yKey] : null
    if (x === null || y === null) continue
    if (config.errorKey) yErrors.push(errorMagnitude(row[config.errorKey]))
    if (config.xErrorKey) xErrors.push(errorMagnitude(row[config.xErrorKey]))
  }
  const color = trace.line?.color || trace.marker?.color
  if (config.errorKey && yErrors.some((value) => value !== null)) {
    trace.error_y = {
      type: 'data',
      symmetric: true,
      array: yErrors,
      visible: true,
      color,
      thickness: 1.2,
      width: 3
    }
  }
  if (config.xErrorKey && xErrors.some((value) => value !== null)) {
    trace.error_x = {
      type: 'data',
      symmetric: true,
      array: xErrors,
      visible: true,
      color,
      thickness: 1.2,
      width: 3
    }
  }
}

function errorMagnitude(value) {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function pivotGrid(dataset, xKey, yKey, zKey) {
  if (!xKey || !yKey || !zKey) return null
  const rows = dataset.rows
  const xSet = new Set()
  const ySet = new Set()
  for (const row of rows) {
    const x = row[xKey]
    const y = row[yKey]
    if (typeof x === 'number' && Number.isFinite(x)) xSet.add(x)
    if (typeof y === 'number' && Number.isFinite(y)) ySet.add(y)
  }
  const x = [...xSet].sort((a, b) => a - b)
  const y = [...ySet].sort((a, b) => a - b)
  if (!x.length || !y.length) return null
  const lookup = new Map()
  for (const row of rows) {
    const rx = row[xKey]
    const ry = row[yKey]
    const rz = row[zKey]
    if (typeof rx === 'number' && typeof ry === 'number' && typeof rz === 'number') {
      lookup.set(`${rx}|${ry}`, rz)
    }
  }
  const z = y.map((yValue) => x.map((xValue) => {
    const value = lookup.get(`${xValue}|${yValue}`)
    return value === undefined ? null : value
  }))
  return { x, y, z }
}

function build3DFigure(dataset, config, { dark }) {
  const darkTheme = dark
  const layout = baseLayout(config, darkTheme)
  layout.scene = {
    xaxis: { title: { text: config.xLabel || columnName(dataset, config.xKey) }, showgrid: !!config.showGrid, gridcolor: darkTheme ? '#334155' : config.gridColor || '#e2e8f0', backgroundcolor: darkTheme ? '#0f172a' : '#ffffff' },
    yaxis: { title: { text: config.yLabel || columnName(dataset, config.yKeys[0]) }, showgrid: !!config.showGrid, gridcolor: darkTheme ? '#334155' : config.gridColor || '#e2e8f0', backgroundcolor: darkTheme ? '#0f172a' : '#ffffff' },
    zaxis: { title: { text: config.zLabel || columnName(dataset, config.zKey) }, showgrid: !!config.showGrid, gridcolor: darkTheme ? '#334155' : config.gridColor || '#e2e8f0', backgroundcolor: darkTheme ? '#0f172a' : '#ffffff' },
    camera: { eye: { x: 1.4, y: 1.4, z: 1.1 } }
  }
  delete layout.xaxis
  delete layout.yaxis
  layout.margin = { l: 0, r: 0, t: 48, b: 0 }
  const data = []
  if (config.plotType === 'scatter3d') {
    const points = dataset.rows.filter((row) => [config.xKey, config.yKeys[0], config.zKey].every((key) => typeof row[key] === 'number'))
    data.push({
      type: 'scatter3d',
      mode: 'markers',
      x: points.map((row) => row[config.xKey]),
      y: points.map((row) => row[config.yKeys[0]]),
      z: points.map((row) => row[config.zKey]),
      marker: { size: Math.max(2, config.markerSize - 2), color: points.map((row) => row[config.zKey]), colorscale: colorScale(config), reversescale: !!config.reverseColorscale, colorbar: { title: { text: columnName(dataset, config.zKey) } }, opacity: 0.9 },
      name: dataset.name
    })
  } else {
    const grid = pivotGrid(dataset, config.xKey, config.yKeys[0], config.zKey)
    if (grid) {
      if (config.plotType === 'surface') {
        data.push({
          type: 'surface',
          x: grid.x,
          y: grid.y,
          z: grid.z,
          colorscale: colorScale(config),
          reversescale: !!config.reverseColorscale,
          colorbar: { title: { text: columnName(dataset, config.zKey) } },
          connectgaps: false
        })
      } else {
        const vertices = { x: [], y: [], z: [] }
        const indexMap = new Map()
        grid.y.forEach((yValue, yi) => {
          grid.x.forEach((xValue, xi) => {
            const zValue = grid.z[yi][xi]
            if (zValue === null) return
            indexMap.set(`${xi}|${yi}`, vertices.x.length)
            vertices.x.push(xValue)
            vertices.y.push(yValue)
            vertices.z.push(zValue)
          })
        })
        const i = []
        const j = []
        const k = []
        for (let yi = 0; yi < grid.y.length - 1; yi += 1) {
          for (let xi = 0; xi < grid.x.length - 1; xi += 1) {
            const a = indexMap.get(`${xi}|${yi}`)
            const b = indexMap.get(`${xi + 1}|${yi}`)
            const c = indexMap.get(`${xi + 1}|${yi + 1}`)
            const d = indexMap.get(`${xi}|${yi + 1}`)
            if ([a, b, c, d].some((value) => value === undefined)) continue
            i.push(a, a)
            j.push(b, c)
            k.push(c, d)
          }
        }
        data.push({
          type: 'mesh3d',
          x: vertices.x,
          y: vertices.y,
          z: vertices.z,
          i, j, k,
          intensity: vertices.z,
          colorscale: colorScale(config),
          reversescale: !!config.reverseColorscale,
          opacity: 0.95,
          colorbar: { title: { text: columnName(dataset, config.zKey) } }
        })
      }
    }
  }
  return { data, layout }
}

function baseLayout(config, dark) {
  const paper = dark ? '#0f172a' : config.background || '#ffffff'
  const plot = dark ? '#111c33' : config.plotBackground || '#ffffff'
  const text = dark ? '#dbe4f0' : '#18243b'
  const muted = dark ? '#8ea0b8' : '#5e6e86'
  const grid = dark ? '#25344c' : config.gridColor || '#e9eef5'
  const axis = {
    gridcolor: grid,
    zerolinecolor: grid,
    linecolor: dark ? '#3b4a63' : '#9aa8bc',
    tickfont: { color: muted, size: Math.max(9, config.fontSize - 2), family: config.fontFamily },
    titlefont: { color: text, size: config.fontSize + 1, family: config.fontFamily },
    showgrid: !!config.showGrid,
    showline: true,
    mirror: false,
    ticks: 'outside',
    tickcolor: dark ? '#3b4a63' : '#9aa8bc',
    tickformat: config.tickFormat || undefined,
    minor: config.showMinorTicks ? { ticks: 'outside', ticklen: 2 } : undefined,
    automargin: true
  }
  const layout = {
    title: { text: config.title || '', font: { size: config.fontSize + 5, color: text, family: config.fontFamily }, x: 0.5, xanchor: 'center' },
    paper_bgcolor: paper,
    plot_bgcolor: plot,
    font: { family: config.fontFamily, size: config.fontSize, color: text },
    margin: { l: 72, r: config.secondaryYKeys.length ? 80 : 28, t: config.title ? 56 : 24, b: 62 },
    hovermode: 'closest',
    showlegend: !!config.showLegend,
    legend: legendLayout(config),
    xaxis: {
      ...axis,
      title: { text: config.xLabel || '', font: { color: text, size: config.fontSize + 1, family: config.fontFamily } },
      type: config.logX ? 'log' : 'linear',
      range: axisRange(config.xMin, config.xMax, config.logX)
    },
    yaxis: {
      ...axis,
      title: { text: config.yLabel || '', font: { color: text, size: config.fontSize + 1, family: config.fontFamily } },
      type: config.logY ? 'log' : 'linear',
      range: axisRange(config.yMin, config.yMax, config.logY)
    },
    bargap: config.bargap
  }
  if (config.secondaryYKeys.length) {
    layout.yaxis2 = {
      ...axis,
      title: { text: config.y2Label || 'Secondary axis', font: { color: text, size: config.fontSize + 1, family: config.fontFamily } },
      overlaying: 'y',
      side: 'right',
      type: config.logY2 ? 'log' : 'linear',
      range: axisRange(config.y2Min, config.y2Max, config.logY2),
      showgrid: false
    }
  }
  return layout
}

function legendLayout(config) {
  const positions = {
    'top-right': { x: 0.99, y: 0.99, xanchor: 'right', yanchor: 'top' },
    'top-left': { x: 0.01, y: 0.99, xanchor: 'left', yanchor: 'top' },
    'bottom-right': { x: 0.99, y: 0.01, xanchor: 'right', yanchor: 'bottom' },
    'bottom-left': { x: 0.01, y: 0.01, xanchor: 'left', yanchor: 'bottom' },
    'top-center': { x: 0.5, y: 1.04, xanchor: 'center', yanchor: 'bottom' }
  }
  return { ...(positions[config.legendPosition] || positions['top-right']), bgcolor: 'rgba(0,0,0,0)', orientation: 'h' }
}

function axisRange(min, max, log) {
  const lower = min === '' || min === null || min === undefined ? null : Number(min)
  const upper = max === '' || max === null || max === undefined ? null : Number(max)
  if (lower === null && upper === null) return undefined
  if (log) {
    const safe = (value) => (value !== null && value > 0 ? Math.log10(value) : null)
    const lo = safe(lower)
    const hi = safe(upper)
    return [lo, hi].some((value) => value === null) ? undefined : [lo, hi]
  }
  return [lower, upper].some((value) => value === null) ? undefined : [lower, upper]
}

function referenceShapes(config, dataset) {
  const shapes = []
  for (const line of config.refLines || []) {
    if (!line || line.value === '' || line.value === undefined) continue
    const value = Number(line.value)
    if (!Number.isFinite(value)) continue
    const color = line.color || '#ef4444'
    if (line.axis === 'x') {
      shapes.push({ type: 'line', x0: value, x1: value, yref: 'paper', y0: 0, y1: 1, line: { color, width: 1.2, dash: 'dash' } })
    } else {
      shapes.push({ type: 'line', y0: value, y1: value, xref: 'paper', x0: 0, x1: 1, line: { color, width: 1.2, dash: 'dash' } })
    }
  }
  return shapes
}

function chartAnnotations(config) {
  return (config.annotations || [])
    .filter((note) => note && note.text)
    .map((note) => ({
      text: String(note.text).slice(0, 500),
      x: note.x === '' || note.x === undefined ? 0.98 : Number(note.x),
      y: note.y === '' || note.y === undefined ? 0.98 : Number(note.y),
      xref: note.x === '' || note.x === undefined ? 'paper' : 'x',
      yref: note.y === '' || note.y === undefined ? 'paper' : 'y',
      showarrow: !!note.arrow,
      font: { size: 11, color: config.fontColor || '#475569' },
      bgcolor: 'rgba(255,255,255,0.6)'
    }))
}

function colorScale(config) {
  const scale = COLORSCALES[config.colorscale] || COLORSCALES.Viridis
  return scale
}

export function columnName(dataset, key) {
  return dataset?.columns?.find((column) => column.key === key)?.name || key || ''
}

export function hexToRgba(hex, alpha) {
  const clean = String(hex || '#3779f6').replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const int = Number.parseInt(value, 16)
  if (!Number.isFinite(int)) return `rgba(55,121,246,${alpha})`
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function regressionTrace(result, color = '#ef4444', label = 'Linear fit') {
  if (!result || result.error || !result.x?.length) return null
  const xs = [...result.x].sort((a, b) => a - b)
  return {
    type: 'scatter',
    mode: 'lines',
    name: label,
    x: xs,
    y: xs.map((x) => result.predict(x)),
    line: { color, width: 2, dash: 'dash' },
    hoverinfo: 'skip'
  }
}

export function graphTemplateFrom(config) {
  const template = { ...config }
  delete template.title
  delete template.hiddenSeries
  return template
}

export function mergeTemplate(config, template) {
  return normalizeConfig({ ...config, ...template, title: config.title })
}
