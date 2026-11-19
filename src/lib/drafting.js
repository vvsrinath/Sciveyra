/** Local drafting templates and claim/evidence helpers for Writing Lab. */

export const DRAFT_TEMPLATES = [
  {
    id: 'imrad',
    label: 'IMRaD paper',
    description: 'Introduction, Methods, Results and Discussion structure for an empirical article.',
    sections: ['Title', 'Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References']
  },
  {
    id: 'review',
    label: 'Literature review',
    description: 'Search strategy, themes, synthesis and research gaps for a narrative or scoping review.',
    sections: ['Title', 'Abstract', 'Introduction', 'Search strategy', 'Themes', 'Synthesis', 'Research gaps', 'Conclusion', 'References']
  },
  {
    id: 'thesis',
    label: 'Thesis chapter',
    description: 'Background, theory, methods and findings structure for a dissertation chapter.',
    sections: ['Chapter title', 'Introduction', 'Background', 'Theory', 'Methods', 'Findings', 'Discussion', 'Conclusion', 'References']
  },
  {
    id: 'conference',
    label: 'Conference paper',
    description: 'Compact problem, approach and evaluation structure for a short conference paper.',
    sections: ['Title', 'Abstract', 'Problem', 'Approach', 'Evaluation', 'Results', 'Discussion', 'References']
  }
]

const GUIDANCE = [
  [/^(title|chapter title)$/i, 'Use a specific, informative title that names the system, method or question.'],
  [/abstract/i, 'State the problem, method, main result and implication in one compact paragraph.'],
  [/introduction/i, 'Move from broad context to the specific gap, then state the aim or hypothesis.'],
  [/background|theory/i, 'Define the concepts and prior work needed to understand your contribution.'],
  [/search strategy/i, 'Record databases, query terms, date limits and inclusion/exclusion rules.'],
  [/methods|approach/i, 'Describe what you did in enough detail for another researcher to repeat it.'],
  [/evaluation/i, 'State the baseline, dataset, metrics and why they are appropriate.'],
  [/results|findings/i, 'Report observations without interpretation. Include uncertainty and negative results.'],
  [/themes|synthesis/i, 'Group evidence into themes, then explain how the themes relate to each other.'],
  [/research gaps|gaps/i, 'Name what is unknown, what is contradictory and what your work changes.'],
  [/discussion/i, 'Interpret the results, compare them with prior work and acknowledge limitations.'],
  [/conclusion/i, 'Answer the research question and give a proportionate final takeaway.'],
  [/references/i, 'List every cited source once. Check author, year, title, venue and DOI before submission.']
]

export function getTemplate(id) {
  return DRAFT_TEMPLATES.find((template) => template.id === id) || null
}

/** Build a Markdown skeleton. Prompts stay in the UI so the export is clean. */
export function buildTemplateContent(id, title = 'Untitled draft') {
  const template = getTemplate(id)
  if (!template) return ''
  const heading = `# ${String(title || 'Untitled draft').trim() || 'Untitled draft'}`
  const sections = template.sections
    .filter((section) => !/^(title|chapter title)$/i.test(section))
    .map((section) => `## ${section}\n\n`)
  return `${heading}\n\n${sections.join('')}`.trimEnd() + '\n'
}

export function sectionGuidance(templateId, title) {
  const name = String(title || '')
  const entry = GUIDANCE.find(([pattern]) => pattern.test(name))
  if (entry) return String(entry[1])
  const template = getTemplate(templateId)
  return template ? `Draft the ${name || 'section'} with a clear topic sentence and a direct link to your research question.` : 'Add a clear topic sentence and supporting evidence.'
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length
}

/** Parse Markdown headings into navigable sections with ranges and word counts. */
export function parseSections(content = '') {
  const text = String(content || '')
  const matches = [...text.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)]
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const bodyStart = start + match[0].length
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length
    const body = text.slice(bodyStart, end)
    return {
      id: `section_${index + 1}`,
      level: match[1].length,
      title: match[2].trim(),
      start,
      bodyStart,
      end,
      body,
      wordCount: wordCount(body)
    }
  })
}

export function sectionAt(sections, position) {
  const at = Number(position) || 0
  return [...(sections || [])].reverse().find((section) => at >= section.start && at <= section.end) || null
}

export function makeClaim({ id = '', text = '', start = 0, end = 0, section = '', referenceIds = [], createdAt = '' } = {}) {
  const cleanText = String(text || '')
  const uniqueIds = [...new Set((Array.isArray(referenceIds) ? referenceIds : []).filter(Boolean).map(String))]
  return {
    id: String(id || `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    text: cleanText,
    start: Number(start) || 0,
    end: Number(end) || 0,
    section: String(section || ''),
    referenceIds: uniqueIds,
    createdAt: String(createdAt || '')
  }
}

export function referenceLabel(reference) {
  if (!reference) return 'Unknown reference'
  const author = Array.isArray(reference.authors) && reference.authors.length
    ? String(reference.authors[0]).split(',')[0]
    : ''
  const year = reference.year ? `(${reference.year})` : ''
  const lead = [author, year].filter(Boolean).join(' ')
  const title = String(reference.title || 'Untitled reference')
  return lead ? `${lead} ${title}` : title
}

export function claimStatus(claim, content = '', references = []) {
  const text = String(claim?.text || '').trim()
  const start = Number(claim?.start) || 0
  const end = Number(claim?.end) || 0
  const inPlace = Boolean(text) && String(content || '').slice(start, end).trim() === text
  const exists = inPlace || Boolean(text) && String(content || '').includes(text)
  const knownIds = new Set((Array.isArray(references) ? references : []).map((reference) => reference.id))
  const linkedIds = (Array.isArray(claim?.referenceIds) ? claim.referenceIds : []).filter((id) => knownIds.has(id))
  const supported = linkedIds.length > 0
  return {
    exists,
    supported,
    unsupported: exists && !supported,
    stale: !exists,
    linkedIds,
    referenceCount: linkedIds.length,
    tone: !exists ? 'slate' : supported ? 'green' : 'amber'
  }
}

export function summarizeClaims(claims = [], content = '', references = []) {
  const statuses = (Array.isArray(claims) ? claims : []).map((claim) => claimStatus(claim, content, references))
  const supported = statuses.filter((status) => status.supported && !status.stale).length
  const stale = statuses.filter((status) => status.stale).length
  const unsupported = statuses.filter((status) => !status.supported && !status.stale).length
  return { total: statuses.length, supported, stale, unsupported }
}

/** Export a human-readable evidence map. Claims no longer in the draft are kept in a separate section. */
export function evidenceMapMarkdown(claims = [], content = '', references = [], title = 'Draft') {
  const byId = new Map((Array.isArray(references) ? references : []).map((reference) => [reference.id, reference]))
  const lines = [`# Evidence map: ${String(title || 'Untitled draft')}`, '']
  const active = []
  const stale = []
  for (const claim of Array.isArray(claims) ? claims : []) {
    ;(claimStatus(claim, content, references).stale ? stale : active).push(claim)
  }
  if (!active.length && !stale.length) {
    lines.push('No claims recorded yet. Select a sentence in the draft and add it as a claim.', '')
  }
  active.forEach((claim, index) => {
    const status = claimStatus(claim, content, references)
    lines.push(`## ${index + 1}. ${status.supported ? 'Supported' : 'Unsupported'} claim`)
    lines.push(`> ${String(claim.text || '').replace(/\s+/g, ' ').trim()}`)
    if (claim.section) lines.push(`Section: ${claim.section}`)
    if (status.linkedIds.length) {
      for (const id of status.linkedIds) lines.push(`- Evidence: ${referenceLabel(byId.get(id))}`)
    } else {
      lines.push('- Evidence: none linked. Treat this claim as unsupported until a source is attached.')
    }
    lines.push('')
  })
  if (stale.length) {
    lines.push('## Claims no longer in the draft', '')
    for (const claim of stale) lines.push(`- ${String(claim.text || '').replace(/\s+/g, ' ').trim()}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}
