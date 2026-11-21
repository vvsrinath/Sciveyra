import { describe, expect, it } from 'vitest'
import {
  ACCESS_LABELS,
  TOOL_CATEGORIES,
  TOOLS,
  categoryLabel,
  countByAccess,
  filterTools,
  isValidTool,
  toolsForCategory
} from '../src/lib/toolDirectory.js'

const REQUESTED_NAMES = [
  'Connected Papers', 'ResearchRabbit', 'Scopus', 'Web of Science', 'IEEE Xplore', 'PubMed',
  'Zotero', 'Mendeley', 'EndNote', 'Notion', 'Obsidian', 'Microsoft OneNote',
  'Google Forms', 'Microsoft Forms', 'Qualtrics', 'SurveyMonkey', 'BeautifulSoup', 'Scrapy',
  'Microsoft Excel', 'SPSS', 'Stata', 'SAS', 'R + RStudio / Posit', 'Python data stack',
  'NVivo', 'ATLAS.ti', 'Overleaf (LaTeX)', 'Microsoft Word', 'Google Docs',
  'Grammarly', 'QuillBot', 'Turnitin', 'iThenticate'
]

describe('research tool directory', () => {
  it('covers every requested category', () => {
    expect(TOOL_CATEGORIES.map((category) => category.id)).toEqual([
      'discovery', 'references', 'notes', 'collection', 'analysis', 'writing', 'integrity'
    ])
  })

  it('lists every tool named in the research request', () => {
    const names = TOOLS.map((tool) => tool.name)
    for (const name of REQUESTED_NAMES) expect(names).toContain(name)
  })

  it('keeps every card honest and well formed', () => {
    expect(TOOLS.length).toBeGreaterThan(35)
    for (const tool of TOOLS) {
      expect(isValidTool(tool), `${tool.id} should be valid`).toBe(true)
      expect(categoryLabel(tool.category)).not.toBe(tool.category)
      if (tool.kind === 'external') {
        expect(tool.to).toBeUndefined()
        expect(tool.url).toMatch(/^https:\/\//)
      } else {
        expect(tool.url).toBeUndefined()
        expect(tool.to).toMatch(/^\//)
      }
    }
  })

  it('marks paid and proprietary services as external, not native', () => {
    const paid = filterTools({ access: 'institutional' }).concat(filterTools({ access: 'proprietary' }))
    expect(paid.length).toBeGreaterThan(8)
    expect(paid.every((tool) => tool.kind === 'external')).toBe(true)
    for (const tool of paid) expect(ACCESS_LABELS[tool.access]).toBeTruthy()
  })

  it('provides a native route for each research stage', () => {
    const nativeByCategory = Object.fromEntries(
      TOOL_CATEGORIES.map((category) => [category.id, toolsForCategory(category.id).filter((tool) => tool.kind === 'native')])
    )
    for (const category of TOOL_CATEGORIES) {
      expect(nativeByCategory[category.id].length, `${category.id} needs a native option`).toBeGreaterThan(0)
    }
  })

  it('filters by query, category and access', () => {
    expect(filterTools({ query: 'BibTeX' }).map((tool) => tool.id)).toContain('sciv-reference-manager')
    expect(filterTools({ query: 'scopus' }).map((tool) => tool.id)).toEqual(['scopus'])
    expect(filterTools({ category: 'integrity' }).every((tool) => tool.category === 'integrity')).toBe(true)
    expect(filterTools({ access: 'open-source' }).every((tool) => tool.access === 'open-source')).toBe(true)
    expect(filterTools({ query: 'not-a-real-tool' })).toEqual([])
  })

  it('summarises access counts', () => {
    const counts = countByAccess()
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(TOOLS.length)
    expect(counts['open-source']).toBeGreaterThan(5)
    expect(counts.proprietary).toBeGreaterThan(0)
  })
})
