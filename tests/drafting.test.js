import { describe, expect, it } from 'vitest'
import {
  DRAFT_TEMPLATES, buildTemplateContent, claimStatus, evidenceMapMarkdown, getTemplate,
  makeClaim, parseSections, sectionAt, sectionGuidance, summarizeClaims
} from '../src/lib/drafting.js'

describe('drafting templates', () => {
  it('offers local outline templates with clean Markdown output', () => {
    expect(DRAFT_TEMPLATES.map((template) => template.id)).toEqual(['imrad', 'review', 'thesis', 'conference'])
    const content = buildTemplateContent('imrad', 'Catalyst study')
    expect(content).toContain('# Catalyst study')
    expect(content).toContain('## Introduction')
    expect(content).toContain('## Methods')
    expect(content).not.toMatch(/^\s*>/m)
  })

  it('provides guidance for common research sections', () => {
    expect(getTemplate('review').label).toBe('Literature review')
    expect(sectionGuidance('imrad', 'Methods')).toMatch(/repeat/i)
    expect(sectionGuidance('review', 'Search strategy')).toMatch(/databases/i)
    expect(sectionGuidance('imrad', 'Custom section')).toBeTruthy()
  })
})

describe('section parsing', () => {
  const content = '# Paper\n\n## Introduction\nSome opening text.\n\n## Methods\nTwo methods words.\n'

  it('parses headings with ranges and word counts', () => {
    const sections = parseSections(content)
    expect(sections.map((section) => section.title)).toEqual(['Paper', 'Introduction', 'Methods'])
    expect(sections[1].wordCount).toBe(3)
    expect(sections[2].wordCount).toBe(3)
    expect(content.slice(sections[2].start, sections[2].end)).toContain('## Methods')
  })

  it('finds the section containing a position', () => {
    const sections = parseSections(content)
    expect(sectionAt(sections, sections[1].bodyStart)?.title).toBe('Introduction')
    expect(sectionAt(sections, content.length + 10)).toBeNull()
  })
})

describe('claim evidence map', () => {
  const references = [{ id: 'r1', authors: ['Nadia Rahman'], year: '2024', title: 'Catalyst kinetics' }]
  const content = 'The catalyst improved the rate substantially.'

  it('marks claims as supported, unsupported or stale', () => {
    const supported = makeClaim({ id: 'c1', text: content, start: 0, end: content.length, referenceIds: ['r1', 'r1'] })
    const unsupported = makeClaim({ id: 'c2', text: 'Another claim', section: 'Discussion' })
    expect(supported.referenceIds).toEqual(['r1'])
    expect(claimStatus(supported, content, references)).toMatchObject({ exists: true, supported: true, stale: false })
    expect(claimStatus(unsupported, content, references)).toMatchObject({ exists: false, stale: true })
    const presentUnsupported = makeClaim({ id: 'c3', text: 'A careful claim', start: 0 })
    expect(claimStatus(presentUnsupported, 'A careful claim and more text.', references).unsupported).toBe(true)
  })

  it('summarizes active claims and exports the evidence map', () => {
    const claims = [
      makeClaim({ id: 'c1', text: content, start: 0, end: content.length, section: 'Results', referenceIds: ['r1'] }),
      makeClaim({ id: 'c2', text: 'The method was novel.', referenceIds: [] }),
      makeClaim({ id: 'c3', text: 'Removed claim', referenceIds: ['r1'] })
    ]
    expect(summarizeClaims(claims, content, references)).toEqual({ total: 3, supported: 1, stale: 2, unsupported: 0 })
    const map = evidenceMapMarkdown(claims, content, references, 'Rate study')
    expect(map).toContain('# Evidence map: Rate study')
    expect(map).toContain('Rahman (2024) Catalyst kinetics')
    expect(map).toContain('Claims no longer in the draft')
  })
})
