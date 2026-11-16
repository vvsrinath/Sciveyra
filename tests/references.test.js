import { describe, expect, it } from 'vitest'
import {
  dedupeReferences, exportBibTeX, exportRIS, findDuplicate, formatAPA,
  formatCitation, formatIEEE, inlineCitation, normalizeReference, parseBibTeX, parseRIS
} from '../src/lib/references.js'

const sample = normalizeReference({
  type: 'article',
  title: 'A practical guide to local-first research tools',
  authors: ['Doe, Jane', 'Smith, John A.'],
  year: '2024',
  journal: 'Journal of Reproducible Workflows',
  volume: '12',
  issue: '3',
  pages: '45-67',
  doi: 'https://doi.org/10.1234/example.2024'
})

describe('normalizeReference', () => {
  it('cleans DOI and whitespace while filling defaults', () => {
    expect(sample.doi).toBe('10.1234/example.2024')
    expect(sample.title).toBe('A practical guide to local-first research tools')
    expect(sample.authors).toEqual(['Doe, Jane', 'Smith, John A.'])
    expect(sample.id).toMatch(/^ref_/)
  })

  it('splits string authors on "and" or semicolons', () => {
    const reference = normalizeReference({ title: 'X', authors: 'Jane Doe; John Smith and Ada Lovelace' })
    expect(reference.authors).toEqual(['Jane Doe', 'John Smith', 'Ada Lovelace'])
  })
})

describe('BibTeX and RIS', () => {
  it('parses BibTeX with nested braces and escaped values', () => {
    const text = `@article{doe2024,
  title = {A {Nested} Title},
  author = {Doe, Jane and Smith, John},
  year = {2024},
  journal = {Journal of Tests},
  doi = {10.1000/test}
}
@book{lovelace1843,
  title = {Notes},
  author = {Lovelace, Ada},
  year = {1843}
}`
    const { references, errors } = parseBibTeX(text)
    expect(errors).toEqual([])
    expect(references).toHaveLength(2)
    expect(references[0].title).toBe('A Nested Title')
    expect(references[0].authors).toEqual(['Doe, Jane', 'Smith, John'])
    expect(references[1].type).toBe('book')
  })

  it('throws on empty or unparseable BibTeX', () => {
    expect(() => parseBibTeX('')).toThrow(/empty/)
    expect(() => parseBibTeX('not bibtex')).toThrow(/No BibTeX/)
  })

  it('round-trips a reference through BibTeX export', () => {
    const text = exportBibTeX([sample])
    expect(text).toContain('@article{')
    expect(text).toContain('title = {A practical guide')
    const { references } = parseBibTeX(text)
    expect(references[0].doi).toBe(sample.doi)
    expect(references[0].authors).toHaveLength(2)
  })

  it('parses and exports RIS records', () => {
    const text = `TY  - JOUR
TI  - Local tools
AU  - Doe, Jane
PY  - 2023
JO  - Testing Quarterly
DO  - 10.5555/ris
ER  - `
    const { references } = parseRIS(text)
    expect(references).toHaveLength(1)
    expect(references[0].type).toBe('article')
    expect(references[0].journal).toBe('Testing Quarterly')
    const exported = exportRIS(references)
    expect(exported).toContain('TY  - JOUR')
    expect(exported).toContain('TI  - Local tools')
  })
})

describe('citation formatting', () => {
  it('formats APA, IEEE and inline citations deterministically', () => {
    expect(formatAPA(sample)).toContain('Doe, J., & Smith, J. A.')
    expect(formatAPA(sample)).not.toContain('..')
    expect(formatAPA(sample)).toContain('(2024).')
    expect(formatAPA(sample)).toContain('https://doi.org/10.1234/example.2024')
    expect(formatIEEE(sample, 3)).toMatch(/^\[3\] J\. Doe and J\. A\. Smith, "A practical/)
    expect(inlineCitation(sample)).toBe('(Doe & Smith, 2024)')
    expect(formatCitation(sample, 'IEEE', 2).startsWith('[2]')).toBe(true)
  })

  it('handles references without authors', () => {
    const anonymous = normalizeReference({ title: 'Anonymous report', year: '' })
    expect(inlineCitation(anonymous)).toBe('(Anon., n.d.)')
    expect(formatAPA(anonymous)).toContain('(n.d.).')
  })
})

describe('deduplication', () => {
  it('deduplicates by DOI first and title/year second', () => {
    const duplicateDoi = { ...sample, id: 'other', title: 'Different title' }
    const duplicateTitle = { ...sample, id: 'other2', doi: '' }
    const unique = dedupeReferences([sample, duplicateDoi, duplicateTitle])
    expect(unique).toHaveLength(1)
  })

  it('finds a duplicate ignoring DOI URL formatting and title punctuation', () => {
    const candidate = { title: 'A practical guide to local-first research tools!', year: '2024', doi: 'https://doi.org/10.1234/example.2024' }
    expect(findDuplicate([sample], candidate)).toBe(sample)
    expect(findDuplicate([sample], { title: 'Different', year: '2024', doi: '' })).toBeNull()
  })
})
