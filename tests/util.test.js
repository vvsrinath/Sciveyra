import { describe, expect, it } from 'vitest'
import { csvEscape, formatBytes, pluralize, slugify } from '../src/lib/util.js'

describe('pluralize', () => {
  it('uses the singular form for one and plural otherwise', () => {
    expect(pluralize(1, 'panel')).toBe('1 panel')
    expect(pluralize(0, 'panel')).toBe('0 panels')
    expect(pluralize(3, 'node')).toBe('3 nodes')
    expect(pluralize(1, 'series', 'series')).toBe('1 series')
    expect(pluralize(2, 'series', 'series')).toBe('2 series')
  })
})

describe('formatBytes', () => {
  it('formats byte sizes into human units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB')
    expect(formatBytes('not a number')).toBe('0 B')
  })
})

describe('slugify', () => {
  it('creates safe file names', () => {
    expect(slugify('Synthetic engine performance (sample)')).toBe('synthetic-engine-performance-sample')
    expect(slugify('', 'dataset')).toBe('dataset')
    expect(slugify('   ')).toBe('file')
  })
})

describe('csvEscape', () => {
  it('quotes values containing separators or quotes', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""')
    expect(csvEscape(null)).toBe('')
  })
})
