import { describe, expect, it } from 'vitest'
import {
  buildDataset, columnValues, datasetToCSV, isMissingToken, numericColumns,
  pairedValues, parseDelimitedText, parseNumeric
} from '../src/lib/parse.js'

describe('parseNumeric', () => {
  it('accepts finite numbers and numeric strings', () => {
    expect(parseNumeric(4.5)).toBe(4.5)
    expect(parseNumeric(' 12.5 ')).toBe(12.5)
    expect(parseNumeric('-3e2')).toBe(-300)
  })

  it('rejects missing tokens and non-numeric text', () => {
    for (const value of ['', 'NA', 'n/a', 'NaN', null, undefined, '-', 'unknown']) {
      expect(parseNumeric(value)).toBeNull()
    }
    expect(isMissingToken('  None ')).toBe(true)
    expect(parseNumeric(true)).toBe(1)
  })
})

describe('parseDelimitedText', () => {
  it('detects a header, infers numeric columns and preserves missing values', () => {
    const { dataset, delimiter } = parseDelimitedText('Sample,Value,Note\nA,1.5,ok\nB,NA,\nC,3,ok\n', 'Test')
    expect(delimiter).toBe(',')
    expect(dataset.name).toBe('Test')
    expect(dataset.columnCount).toBe(3)
    expect(dataset.rowCount).toBe(3)
    expect(dataset.columns.map((column) => column.type)).toEqual(['text', 'numeric', 'text'])
    expect(dataset.rows[1].c1).toBeNull()
    expect(dataset.warnings.some((warning) => warning.includes('missing'))).toBe(true)
  })

  it('supports tab delimiters and quoted values with commas', () => {
    const { dataset } = parseDelimitedText('X\tLabel\n1\t"alpha, beta"\n2\tgamma\n', 'TSV', '\t')
    expect(dataset.columns[1].type).toBe('text')
    expect(dataset.rows[0].c1).toBe('alpha, beta')
  })

  it('rejects empty files and headers without data', () => {
    expect(() => parseDelimitedText('   ')).toThrow(/empty/)
    expect(() => parseDelimitedText('X,Y\n')).toThrow(/no data rows/)
  })
})

describe('buildDataset', () => {
  it('rejects a dataset with no usable rows', () => {
    expect(() => buildDataset({ name: 'Empty', headers: ['A'], rows: [['']] })).toThrow(/No usable data/)
  })

  it('renames duplicate columns and keeps first rows', () => {
    const { dataset } = parseDelimitedText('X,X,Y\n1,2,3\n4,5,6\n', 'Duplicate')
    expect(dataset.columns[1].name).toBe('X (2)')
    expect(dataset.warnings.some((warning) => warning.includes('Duplicate'))).toBe(true)
  })
})

describe('dataset helpers', () => {
  const dataset = buildDataset({ name: 'Helpers', headers: ['X', 'Y'], rows: [[1, 2], [2, 4], [3, 6]], source: 'manual' })

  it('lists numeric columns and converts values', () => {
    expect(numericColumns(dataset).map((column) => column.name)).toEqual(['X', 'Y'])
    expect(columnValues(dataset, 'c1')).toEqual([2, 4, 6])
    expect(pairedValues(dataset, 'c0', 'c1')).toEqual({ xs: [1, 2, 3], ys: [2, 4, 6] })
  })

  it('serializes back to CSV with a header row', () => {
    const csv = datasetToCSV(dataset)
    expect(csv.split('\n')[0]).toBe('X,Y')
    expect(csv.split('\n')).toHaveLength(4)
  })
})
