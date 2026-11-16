import { describe, expect, it } from 'vitest'
import { normalizeDoi, parseDoiFromText } from '../src/lib/metadata.js'
import { formatCitation, inlineCitation, CITATION_STYLES, abbreviateJournal } from '../src/lib/references.js'

const reference = {
  type: 'article',
  title: 'Observing the quantum dance of atoms',
  authors: ['Curie, Marie', 'Einstein, Albert', 'Bohr, Niels'],
  year: '2021',
  journal: 'Physical Review Letters',
  volume: '126',
  issue: '4',
  pages: '1234-1240',
  doi: '10.1103/PhysRevLett.126.123456'
}

describe('DOI helpers', () => {
  it('normalises DOI inputs', () => {
    expect(normalizeDoi('https://doi.org/10.1234/abc')).toBe('10.1234/abc')
    expect(normalizeDoi('doi: 10.1234/abc.')).toBe('10.1234/abc')
  })

  it('extracts a DOI from free text', () => {
    expect(parseDoiFromText('See https://doi.org/10.1038/nphys1170 for details.')).toBe('10.1038/nphys1170')
    expect(parseDoiFromText('no identifier here')).toBe('')
  })
})

describe('citation styles', () => {
  it('exposes all documented styles', () => {
    expect(CITATION_STYLES).toContain('Vancouver')
    expect(CITATION_STYLES).toContain('Harvard')
    expect(CITATION_STYLES).toContain('Nature')
    expect(CITATION_STYLES).toContain('Science')
    expect(CITATION_STYLES).toContain('ACS')
  })

  it('formats author-date styles without doubled punctuation', () => {
    for (const style of ['APA 7', 'MLA 9', 'Chicago', 'Harvard']) {
      const output = formatCitation(reference, style)
      expect(output).not.toContain('..')
      expect(output).toContain('Curie')
    }
  })

  it('formats numbered styles with an index', () => {
    const vancouver = formatCitation(reference, 'Vancouver', 3)
    expect(vancouver.startsWith('3. ')).toBe(true)
    const science = formatCitation(reference, 'Science', 5)
    expect(science.startsWith('5. ')).toBe(true)
    const acs = formatCitation(reference, 'ACS', 2)
    expect(acs).toContain('Curie, M')
  })

  it('abbreviates well-known journals', () => {
    expect(abbreviateJournal('Physical Review Letters')).toBe('Phys. Rev. Lett.')
    expect(abbreviateJournal('Some Unknown Journal')).toBe('Some Unknown Journal')
  })

  it('produces numeric inline citations for numbered styles', () => {
    expect(inlineCitation(reference, 4, 'IEEE')).toBe('[4]')
    expect(inlineCitation(reference, 4, 'Vancouver')).toBe('[4]')
    expect(inlineCitation(reference, 4, 'APA 7')).toContain('Curie et al.')
  })

  it('handles author suffixes in family-name parsing', () => {
    const output = formatCitation({ ...reference, authors: ['Smith, John, Jr.'] }, 'APA 7')
    expect(output).toContain('Smith')
    expect(output).not.toContain('Smith, J..')
  })
})
