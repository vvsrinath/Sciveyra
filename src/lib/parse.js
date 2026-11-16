import Papa from 'papaparse'
import { csvEscape, nowIso, uid } from './util.js'

export const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', 'nil', '-', '—', '.'])
export const MAX_ROWS = 50000
export const MAX_COLUMNS = 200

export function isMissingToken(value) {
  if (value === null || value === undefined) return true
  return MISSING_TOKENS.has(String(value).trim().toLowerCase())
}

export function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (isMissingToken(value)) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  const cleaned = String(value).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '')
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

export function parseDelimitedText(text, name = 'Imported data', forcedDelimiter = '') {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.')
  const result = Papa.parse(text.replace(/^\uFEFF/, ''), {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: forcedDelimiter || '',
    dynamicTyping: false
  })
  if (!result.data || !result.data.length) {
    throw new Error('No rows could be read from this file. Check the delimiter and file contents.')
  }
  if (result.data.length > MAX_ROWS + 1) {
    throw new Error(`This file has more than ${MAX_ROWS.toLocaleString()} rows. Split it into smaller datasets.`)
  }
  const rawRows = result.data.map((row) => row.map((value) => (typeof value === 'string' ? value.trim() : value)))
  const width = Math.max(...rawRows.map((row) => row.length))
  if (width > MAX_COLUMNS) throw new Error(`This file has more than ${MAX_COLUMNS} columns.`)
  const padded = rawRows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
  if (padded.length === 1 && padded[0].every((value) => parseNumeric(value) === null)) {
    throw new Error('The file contains a header but no data rows.')
  }
  const warnings = []
  if (result.errors?.length) {
    const first = result.errors[0]
    warnings.push(`CSV parser warning: ${first.message}${first.row !== undefined ? ` (row ${first.row + 1})` : ''}.`)
  }
  const header = detectHeader(padded)
  let names = header ? padded[0].map((value, index) => String(value || '').trim() || `Column ${index + 1}`) : padded[0].map((_, index) => `Column ${index + 1}`)
  const seen = new Map()
  names = names.map((headerName) => {
    const count = seen.get(headerName) || 0
    seen.set(headerName, count + 1)
    if (count === 0) return headerName
    warnings.push(`Duplicate column name "${headerName}" renamed to "${headerName} (${count + 1})".`)
    return `${headerName} (${count + 1})`
  })
  const dataRows = header ? padded.slice(1) : padded
  if (!dataRows.length) throw new Error('The file contains a header but no data rows.')
  const dataset = buildDataset({
    name,
    headers: names,
    rows: dataRows,
    source: 'delimited',
    warnings
  })
  return { dataset, warnings, delimiter: result.meta?.delimiter || forcedDelimiter || ',' }
}

function detectHeader(rows) {
  if (rows.length < 2) return false
  const first = rows[0]
  const second = rows[1]
  const textLike = first.filter((value) => !isMissingToken(value) && parseNumeric(value) === null).length
  const secondNumeric = second.filter((value) => parseNumeric(value) !== null).length
  return textLike > 0 && secondNumeric > 0
}

function normalizeExcelValue(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('result' in value) return value.result ?? ''
    if ('text' in value) return value.text ?? ''
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('hyperlink' in value) return value.text || value.hyperlink || ''
    if ('error' in value) return ''
    return String(value)
  }
  return value
}

/**
 * Parse a CSV/TSV/XLSX file into a dataset and warnings.
 * @param {File} file
 * @returns {Promise<{dataset: import('../types').Dataset, warnings: string[]}>}
 */
export async function parseSpreadsheetFile(file) {
  if (!file) throw new Error('No file was selected.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (['csv', 'tsv', 'txt'].includes(extension)) {
    const text = await file.text()
    return parseDelimitedText(text, stripExtension(file.name), extension === 'tsv' ? '\t' : '')
  }
  if (extension === 'xlsx' || extension === 'xlsm') {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const sheets = workbook.worksheets
    if (!sheets.length) throw new Error('The workbook does not contain any worksheets.')
    const sheet = sheets[0]
    const rows = []
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = []
      const count = Math.max(row.cellCount, 1)
      for (let index = 1; index <= count; index += 1) {
        const cell = row.getCell(index)
        values.push(normalizeExcelValue(cell.value))
      }
      rows.push(values)
    })
    if (!rows.length) throw new Error('The first worksheet is empty.')
    if (rows.length > MAX_ROWS + 1) throw new Error(`The worksheet has more than ${MAX_ROWS.toLocaleString()} rows.`)
    const width = Math.max(...rows.map((row) => row.length))
    const padded = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
    const header = detectHeader(padded)
    const names = header ? padded[0].map((value, index) => String(value || '').trim() || `Column ${index + 1}`) : padded[0].map((_, index) => `Column ${index + 1}`)
    const warnings = []
    if (sheets.length > 1) {
      warnings.push(`Only the first worksheet ("${sheet.name}") was imported. ${sheets.length - 1} other sheet(s) were ignored.`)
    }
    const dataset = buildDataset({
      name: stripExtension(file.name),
      headers: uniqueNames(names, warnings),
      rows: header ? padded.slice(1) : padded,
      source: 'excel',
      warnings
    })
    return { dataset, warnings }
  }
  throw new Error('Unsupported file type. Use CSV, TSV, TXT, XLSX, or XLSM.')
}

function uniqueNames(names, warnings) {
  const seen = new Map()
  return names.map((name) => {
    const count = seen.get(name) || 0
    seen.set(name, count + 1)
    if (count === 0) return name
    warnings.push(`Duplicate column name "${name}" renamed to "${name} (${count + 1})".`)
    return `${name} (${count + 1})`
  })
}

function stripExtension(name) {
  return String(name || 'Imported data').replace(/\.[^.]+$/, '') || 'Imported data'
}

/**
 * @param {{name: string, headers: string[], rows: any[][], source?: string, warnings?: string[]}} options
 * @returns {import('../types').Dataset}
 */
export function buildDataset({ name, headers, rows, source = 'manual', warnings = [] }) {
  if (!headers?.length) throw new Error('At least one column is required.')
  if (!rows?.length) throw new Error('At least one data row is required.')
  const columns = headers.map((header, index) => ({
    key: `c${index}`,
    name: String(header || `Column ${index + 1}`).trim() || `Column ${index + 1}`,
    type: 'text'
  }))
  const missingByColumn = columns.map(() => 0)
  const invalidByColumn = columns.map(() => 0)
  const numericByColumn = columns.map(() => 0)
  const nonMissingByColumn = columns.map(() => 0)
  const invalidExamples = columns.map(() => [])

  const parsedRows = rows.map((row) => {
    const record = {}
    columns.forEach((column, index) => {
      const raw = row[index]
      if (isMissingToken(raw)) {
        record[column.key] = null
        missingByColumn[index] += 1
      } else {
        nonMissingByColumn[index] += 1
        const numeric = parseNumeric(raw)
        if (numeric !== null) {
          numericByColumn[index] += 1
          record[column.key] = numeric
        } else {
          invalidByColumn[index] += 1
          if (invalidExamples[index].length < 3) invalidExamples[index].push(String(raw).slice(0, 24))
          record[column.key] = String(raw)
        }
      }
    })
    return record
  })

  columns.forEach((column, index) => {
    const nonMissing = nonMissingByColumn[index]
    if (nonMissing === 0) column.type = 'empty'
    else if (numericByColumn[index] === nonMissing) column.type = 'numeric'
    else if (numericByColumn[index] > 0) column.type = 'mixed'
    else column.type = 'text'
    if (invalidByColumn[index] > 0) {
      warnings.push(`${column.name}: ${invalidByColumn[index]} non-numeric value(s) kept as text (${invalidExamples[index].join(', ')}).`)
    }
    if (missingByColumn[index] > 0) {
      warnings.push(`${column.name}: ${missingByColumn[index]} missing value(s). Missing values are not plotted.`)
    }
  })

  const cleanRows = parsedRows.filter((row) => Object.values(row).some((value) => value !== null && value !== ''))
  if (!cleanRows.length) throw new Error('No usable data rows were found after ignoring blank rows.')

  return {
    id: uid('ds'),
    name,
    source,
    columns,
    rows: cleanRows,
    rowCount: cleanRows.length,
    columnCount: columns.length,
    warnings: [...new Set(warnings)],
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
}

/**
 * @param {string} [name]
 * @returns {import('../types').Dataset}
 */
export function emptyDataset(name = 'Untitled dataset') {
  return buildDataset({
    name,
    headers: ['X', 'Y', 'Y2'],
    rows: [[0, 0, 0], [1, 1, 1], [2, 4, 4], [3, 9, 9], [4, 16, 16]],
    source: 'manual'
  })
}

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @returns {import('../types').Column[]}
 */
export function numericColumns(dataset) {
  return (dataset?.columns || []).filter((column) => column.type === 'numeric' || column.type === 'mixed')
}

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @param {string} key
 * @returns {(number|null)[]}
 */
export function columnValues(dataset, key) {
  if (!dataset || !key) return []
  return dataset.rows.map((row) => {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    return null
  })
}

/**
 * @param {import('../types').Dataset|null|undefined} dataset
 * @param {string} xKey
 * @param {string} yKey
 * @returns {{xs: number[], ys: number[]}}
 */
export function pairedValues(dataset, xKey, yKey) {
  const xs = []
  const ys = []
  for (const row of dataset?.rows || []) {
    const x = typeof row[xKey] === 'number' && Number.isFinite(row[xKey]) ? row[xKey] : null
    const y = typeof row[yKey] === 'number' && Number.isFinite(row[yKey]) ? row[yKey] : null
    if (x !== null && y !== null) {
      xs.push(x)
      ys.push(y)
    }
  }
  return { xs, ys }
}

export function datasetToCSV(dataset) {
  if (!dataset) return ''
  const header = dataset.columns.map((column) => csvEscape(column.name)).join(',')
  const lines = dataset.rows.map((row) => dataset.columns.map((column) => csvEscape(row[column.key])).join(','))
  return [header, ...lines].join('\n')
}

export function datasetToMatrix(dataset) {
  if (!dataset) return []
  return dataset.rows.map((row) => dataset.columns.map((column) => row[column.key]))
}

export function renameDatasetColumn(dataset, key, name) {
  return {
    ...dataset,
    columns: dataset.columns.map((column) => (column.key === key ? { ...column, name: String(name).trim() || column.name } : column))
  }
}

export function datasetNumericSummary(dataset) {
  const columns = numericColumns(dataset)
  return {
    rows: dataset?.rows?.length || 0,
    columns: dataset?.columns?.length || 0,
    numericColumns: columns.map((column) => ({
      key: column.key,
      name: column.name,
      nonMissing: columnValues(dataset, column.key).filter((value) => value !== null).length
    }))
  }
}

/**
 * @param {import('../types').Dataset} dataset
 * @returns {import('../types').Dataset}
 */
export function retypeDataset(dataset) {
  if (!dataset) throw new Error('No dataset to update.')
  const rebuilt = buildDataset({
    name: dataset.name,
    headers: dataset.columns.map((column) => column.name),
    rows: dataset.rows.map((row) => dataset.columns.map((column) => row[column.key])),
    source: dataset.source || 'manual',
    warnings: []
  })
  return {
    ...rebuilt,
    id: dataset.id,
    name: dataset.name,
    original: dataset.original,
    createdAt: dataset.createdAt,
    updatedAt: nowIso()
  }
}

/**
 * @param {import('../types').Dataset} dataset
 * @param {string} [name]
 * @returns {import('../types').Dataset}
 */
export function cloneDataset(dataset, name = `${dataset?.name || 'Dataset'} copy`) {
  const rebuilt = retypeDataset(dataset)
  return { ...rebuilt, id: uid('ds'), name, createdAt: nowIso(), updatedAt: nowIso() }
}
