export type ColumnType = 'numeric' | 'text' | 'mixed' | 'empty'

export type Column = { key: string; name: string; type: ColumnType }

export type DataValue = string | number | null

export type DataRow = Record<string, DataValue>

export type Dataset = {
  id: string
  name: string
  source: string
  columns: Column[]
  rows: DataRow[]
  rowCount: number
  columnCount: number
  warnings: string[]
  original?: { columns: Column[]; rows: DataRow[] }
  createdAt: string
  updatedAt: string
}

export type RefLine = { axis: 'x' | 'y'; value: number | string; color?: string; label?: string }
export type ChartAnnotation = { text: string; x?: number | string; y?: number | string; arrow?: boolean }

export type GraphConfig = {
  plotType: string
  xKey: string
  yKeys: string[]
  secondaryYKeys: string[]
  errorKey: string
  xErrorKey: string
  zKey: string
  xLabel: string
  yLabel: string
  y2Label: string
  zLabel?: string
  title: string
  xMin: string | number
  xMax: string | number
  yMin: string | number
  yMax: string | number
  y2Min: string | number
  y2Max: string | number
  logX: boolean
  logY: boolean
  logY2: boolean
  showGrid: boolean
  gridColor: string
  showMinorTicks: boolean
  tickFormat: string
  fontFamily: string
  fontSize: number
  lineWidth: number
  lineDash: string
  markerShape: string
  markerSize: number
  showMarkers: boolean
  showLegend: boolean
  legendPosition: string
  colors: string[]
  background: string
  plotBackground: string
  colorscale: string
  reverseColorscale: boolean
  width: number
  height: number
  smoothing: boolean
  lineShape: string
  bargap: number
  barMode: string
  histogramBins: number
  boxPoints: string
  annotations: ChartAnnotation[]
  refLines: RefLine[]
  hiddenSeries?: string[]
  fontColor?: string
  surfaceContours?: boolean
  surfaceLighting?: 'soft' | 'glossy' | 'matte' | 'flat'
  surfaceOpacity?: number
}

export type GraphRecord = {
  id: string
  name: string
  datasetId: string
  mode?: '2d' | '3d'
  config: GraphConfig
  analysis?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type Reference = {
  id: string
  type: string
  title: string
  authors: string[]
  year: string
  journal: string
  volume: string
  issue: string
  pages: string
  doi: string
  url: string
  publisher: string
  abstract: string
  notes: string
  key: string
  source: string
  createdAt: string
  updatedAt: string
}

export type AssetKind = 'svg' | 'image' | 'file'

export type Asset = {
  id: string
  name: string
  kind: AssetKind
  data: string
  mime?: string
  size?: number
  width?: number
  height?: number
  createdAt: string
  updatedAt: string
}

export type FigurePanel = {
  id: string
  label: string
  assetId?: string
  src?: string
  kind: 'svg' | 'image' | 'graph'
  graphId?: string
  graphDatasetId?: string
  x: number
  y: number
  width: number
  height: number
  keepAspect?: boolean
  caption?: string
}

export type FigureRecord = {
  id: string
  name: string
  width: number
  height: number
  background: string
  panels: FigurePanel[]
  caption: string
  createdAt: string
  updatedAt: string
}

export type DiagramNodeShape = 'rect' | 'rounded' | 'circle' | 'diamond' | 'text'
export type DiagramNode = {
  id: string
  shape: DiagramNodeShape
  x: number
  y: number
  width: number
  height: number
  text: string
  fill: string
  stroke: string
  fontSize: number
  textColor: string
}
export type DiagramEdge = {
  id: string
  from: string
  to: string
  label?: string
  dashed?: boolean
  arrow?: boolean
}
export type DiagramRecord = {
  id: string
  name: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  createdAt: string
  updatedAt: string
}

export type ClaimRecord = {
  id: string
  text: string
  start: number
  end: number
  section: string
  referenceIds: string[]
  createdAt?: string
}

export type DraftRecord = {
  id: string
  title: string
  content: string
  template?: string
  claims?: ClaimRecord[]
  createdAt: string
  updatedAt: string
}
