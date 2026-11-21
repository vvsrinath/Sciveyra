import { buildBibliography, citationAudit, parseCitations, renumberCitations } from '../src/lib/citationEngine.js'
import { buildFigureBlock, buildTableBlock, numberDocument, scanNumberables } from '../src/lib/documentNumbering.js'
import { CHECK_ORDER, assessManuscript, qualityLabel } from '../src/lib/manuscriptQuality.js'

const references = [
  {
    id: 'r1', key: 'curie2020', type: 'article', title: 'Paper one', authors: ['Curie, Marie'],
    year: '2020', journal: 'Journal of Tests', volume: '1', issue: '2', pages: '3-9', doi: '', url: '',
    publisher: '', abstract: '', notes: '', source: 'test', createdAt: '', updatedAt: ''
  },
  {
    id: 'r2', key: 'smith2021', type: 'article', title: 'Paper two', authors: ['Smith, John'],
    year: '2021', journal: 'Journal of Tests', volume: '2', issue: '1', pages: '10-18', doi: '', url: '',
    publisher: '', abstract: '', notes: '', source: 'test', createdAt: '', updatedAt: ''
  }
]

const assets = [
  { id: 'asset-1', name: 'plot.png', kind: 'image', data: 'data:image/png;base64,AAA', createdAt: '', updatedAt: '' }
]

describe('citation engine', () => {
  it('parses tokens and display citations in first-use order', () => {
    const markdown = 'Intro [@smith2021]. Later [@curie2020] and (Curie, 2020).'
    const parsed = parseCitations(markdown, references, 'APA 7')
    expect(parsed.usedIds).toEqual(['r2', 'r1'])
    expect(parsed.unresolved).toEqual([])
    expect(parsed.usages.filter((usage) => usage.source === 'marker')).toHaveLength(2)
    expect(parsed.usages.find((usage) => usage.source === 'marker').index).toBe(1)
    expect(parsed.usages.filter((usage) => usage.source === 'display')).toHaveLength(1)
  })

  it('renumbers numeric-style citations by first appearance', () => {
    const result = renumberCitations('A [@smith2021]; B [@curie2020].', references, 'IEEE')
    expect(result.markdown).toBe('A [1]; B [2].')
    expect(result.changed).toBe(true)
  })

  it('builds a cited bibliography and replaces an old References section', () => {
    const markdown = 'Text [@curie2020].\n\n## References\n\n- stale entry\n\n## Notes\n\nKeep me.'
    const result = buildBibliography(markdown, references, 'APA 7')
    expect(result.usedIds).toEqual(['r1'])
    expect(result.unusedIds).toEqual(['r2'])
    expect(result.markdown).toContain('Curie, M. (2020). Paper one.')
    expect(result.markdown).not.toContain('stale entry')
    expect(result.markdown).toContain('## Notes')
  })

  it('audits unresolved tokens honestly', () => {
    const audit = citationAudit('Text [@missing2022].', references, 'APA 7')
    expect(audit.usageCount).toBe(0)
    expect(audit.unresolved).toEqual(['missing2022'])
    expect(audit.uncitedIds).toEqual(['r1', 'r2'])
  })
})

describe('document numbering', () => {
  it('numbers figures and tables by appearance and resolves cross-references', () => {
    const markdown = [
      '![plot](asset://asset-1)',
      '',
      'See @fig:asset-1.',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      'See @tbl:results.',
      '',
      '*Table [@tbl:results]. Results summary*'
    ].join('\n')
    const result = numberDocument(markdown, { assets })
    expect(result.items.map((item) => `${item.label}`)).toEqual(['Figure 1', 'Table 1'])
    expect(result.markdown).toContain('*Figure 1. plot*')
    expect(result.markdown).toContain('See Figure 1.')
    expect(result.markdown).toContain('See Table 1.')
    expect(result.unresolved).toEqual([])
  })

  it('is idempotent once captions have been rendered', () => {
    const once = numberDocument(buildFigureBlock(assets[0], 'Response'), { assets })
    const twice = numberDocument(once.markdown, { assets })
    expect(twice.markdown).toBe(once.markdown)
    expect(scanNumberables(once.markdown, assets)).toHaveLength(1)
  })

  it('builds table blocks with stable cross-reference tokens', () => {
    const block = buildTableBlock([['Metric', 'Value'], ['n', '12']], 'Summary', 'summary')
    expect(block).toContain('| Metric | Value |')
    expect(block).toContain('*Table [@tbl:summary]. Summary*')
    const numbered = numberDocument(block)
    expect(numbered.markdown).toContain('*Table 1. Summary*')
  })
})

describe('manuscript quality', () => {
  const content = [
    '# Study',
    '',
    '## Introduction',
    '',
    'We tested [@curie2020] with a short sentence.',
    '',
    '## Methods',
    '',
    'Methods were straightforward.',
    '',
    '## Results',
    '',
    'The result was clear.',
    '',
    '## Discussion',
    '',
    'The implication is useful.',
    '',
    '## References',
    '',
    '- Curie, M. (2020). Paper one.',
    '',
    '## TODO'
  ].join('\n')

  it('is deterministic and bounded', () => {
    const first = assessManuscript({ content, references, template: 'imrad', targetWords: 10 })
    const second = assessManuscript({ content, references, template: 'imrad', targetWords: 10 })
    expect(first).toEqual(second)
    expect(first.score).toBeGreaterThanOrEqual(0)
    expect(first.score).toBeLessThanOrEqual(100)
    expect(first.checks.map((check) => check.id)).toEqual(CHECK_ORDER)
  })

  it('reports placeholders, missing sections and citation usage', () => {
    const result = assessManuscript({ content, references, template: 'imrad', targetWords: 10 })
    expect(result.checks.find((check) => check.id === 'placeholders').status).toBe('warn')
    expect(result.checks.find((check) => check.id === 'structure').status).toBe('warn')
    expect(result.checks.find((check) => check.id === 'citations').status).toBe('pass')
    expect(result.metrics.citationCount).toBe(1)
    expect(result.metrics.missingSections).toEqual(['Abstract', 'Conclusion'])
  })

  it('returns a neutral zero score for an empty draft', () => {
    const result = assessManuscript({ content: '', template: 'imrad' })
    expect(result.score).toBe(0)
    expect(result.grade).toBe('Not started')
    expect(result.checks.every((check) => check.status === 'neutral')).toBe(true)
  })

  it('labels score bands without AI claims', () => {
    expect(qualityLabel(95)).toBe('Excellent')
    expect(qualityLabel(78)).toBe('Good')
    expect(qualityLabel(64)).toBe('Fair')
    expect(qualityLabel(30)).toBe('Needs work')
  })
})
