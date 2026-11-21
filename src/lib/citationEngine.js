/**
 * Deterministic, local citation-token engine for the Writing Lab.
 * Tokens look like `[@referenceKey]` and are resolved for preview/export only,
 * so the stored Markdown stays small and editable. No network and no clock.
 */
import { CITATION_STYLES, formatCitation, inlineCitation, referenceKey } from './references.js'

const NUMERIC_STYLES = new Set(['IEEE', 'Vancouver', 'Nature', 'Science', 'ACS'])
const MARKER_SOURCE = '\\[@([A-Za-z0-9][A-Za-z0-9_-]*)\\]'
const NUMERIC_SOURCE = '\\[(\\d{1,3})\\]'

function normalizeStyle(style) {
  return CITATION_STYLES.includes(style) ? style : 'APA 7'
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Find fenced/inline code spans so citation-like text there is never rewritten. */
function codeRanges(markdown) {
  const ranges = []
  const push = (start, end) => {
    if (!ranges.some(([from, to]) => start < to && end > from)) ranges.push([start, end])
  }
  const fenced = /```[\s\S]*?```/g
  let match
  while ((match = fenced.exec(markdown))) push(match.index, match.index + match[0].length)
  const inline = /`[^`\n]*`/g
  while ((match = inline.exec(markdown))) push(match.index, match.index + match[0].length)
  return ranges.sort((a, b) => a[0] - b[0])
}

function transformOutsideCode(markdown, transform) {
  let output = ''
  let cursor = 0
  for (const [start, end] of codeRanges(markdown)) {
    output += transform(markdown.slice(cursor, start), cursor)
    output += markdown.slice(start, end)
    cursor = end
  }
  output += transform(markdown.slice(cursor), cursor)
  return output
}

function referenceMaps(references) {
  const list = Array.isArray(references) ? references : []
  const byKey = new Map()
  const byId = new Map()
  list.forEach((reference) => {
    byKey.set(referenceKey(reference).toLowerCase(), reference)
    byId.set(reference.id, reference)
  })
  return { list, byKey, byId }
}

/**
 * Find every citation usage in first-appearance order.
 * @param {string} markdown
 * @param {any[]} references
 * @param {string} style
 * @returns {{ usages: any[], usedIds: string[], unresolved: string[] }}
 */
export function parseCitations(markdown, references = [], style = 'APA 7') {
  const source = String(markdown || '')
  const selectedStyle = normalizeStyle(style)
  const { list, byKey } = referenceMaps(references)
  const found = []

  transformOutsideCode(source, (chunk, offset) => {
    for (const match of chunk.matchAll(new RegExp(MARKER_SOURCE, 'g'))) {
      const reference = byKey.get(match[1].toLowerCase())
      found.push({
        raw: match[0], key: match[1], start: offset + match.index, end: offset + match.index + match[0].length,
        referenceId: reference?.id || null, source: 'marker'
      })
    }
    for (const match of chunk.matchAll(new RegExp(NUMERIC_SOURCE, 'g'))) {
      const index = Number(match[1])
      const reference = list[index - 1]
      found.push({
        raw: match[0], key: match[1], start: offset + match.index, end: offset + match.index + match[0].length,
        referenceId: reference?.id || null, source: 'numeric', sourceIndex: index
      })
    }
    if (!NUMERIC_STYLES.has(selectedStyle)) {
      for (const reference of list) {
        const display = inlineCitation(reference, list.indexOf(reference) + 1, selectedStyle)
        if (!display || display.startsWith('[')) continue
        for (const match of chunk.matchAll(new RegExp(escapeRegExp(display), 'g'))) {
          found.push({
            raw: display, key: referenceKey(reference), start: offset + match.index,
            end: offset + match.index + display.length, referenceId: reference.id, source: 'display'
          })
        }
      }
    }
    return chunk
  })

  const priority = { marker: 0, numeric: 1, display: 2 }
  found.sort((a, b) => a.start - b.start || priority[a.source] - priority[b.source] || b.end - a.end)
  const usages = []
  let lastEnd = -1
  for (const usage of found) {
    if (usage.start < lastEnd) continue
    usages.push(usage)
    lastEnd = usage.end
  }

  const usedIds = []
  for (const usage of usages) {
    if (!usage.referenceId) continue
    if (!usedIds.includes(usage.referenceId)) usedIds.push(usage.referenceId)
    usage.index = usedIds.indexOf(usage.referenceId) + 1
  }
  const unresolved = [...new Set(usages.filter((usage) => usage.source === 'marker' && !usage.referenceId).map((usage) => usage.key))]
  return { usages, usedIds, unresolved }
}

/**
 * Replace citation tokens/usages with their display form in first-use order.
 * Existing numeric or author-year citations are normalised too.
 */
export function renumberCitations(markdown, references = [], style = 'APA 7') {
  const source = String(markdown || '')
  const selectedStyle = normalizeStyle(style)
  const { usages } = parseCitations(source, references, selectedStyle)
  const { byId } = referenceMaps(references)
  let output = ''
  let cursor = 0
  for (const usage of usages) {
    if (!usage.referenceId || usage.start < cursor) continue
    const reference = byId.get(usage.referenceId)
    if (!reference) continue
    output += source.slice(cursor, usage.start)
    output += NUMERIC_STYLES.has(selectedStyle)
      ? `[${usage.index}]`
      : inlineCitation(reference, usage.index, selectedStyle)
    cursor = usage.end
  }
  output += source.slice(cursor)
  return { markdown: output, changed: output !== source, usages: usages.filter((usage) => usage.referenceId) }
}

export function resolveCitationMarkers(markdown, references = [], style = 'APA 7') {
  return renumberCitations(markdown, references, style)
}

/** Audit which saved references are cited, uncited or missing from the library. */
export function citationAudit(markdown, references = [], style = 'APA 7') {
  const source = String(markdown || '')
  const parsed = parseCitations(source, references, style)
  const list = Array.isArray(references) ? references : []
  const citedIds = parsed.usedIds
  const uncitedIds = list.filter((reference) => !citedIds.includes(reference.id)).map((reference) => reference.id)
  return {
    ...parsed,
    citedIds,
    uncitedIds,
    missingIds: parsed.unresolved,
    usageCount: parsed.usages.filter((usage) => usage.referenceId).length,
    hasBibliography: /^#{1,2}\s+References\b/im.test(source)
  }
}

function replaceReferencesSection(markdown, block) {
  const lines = String(markdown || '').split('\n')
  const start = lines.findIndex((line) => /^##\s+References\s*$/i.test(line.trim()))
  if (start === -1) return `${lines.join('\n').trimEnd()}\n\n${block}\n`.trimStart()
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+\S/.test(lines[index].trim())) { end = index; break }
  }
  return [...lines.slice(0, start), ...block.split('\n'), ...lines.slice(end)].join('\n')
}

/**
 * Build or refresh a `## References` block from cited references.
 * If nothing is cited yet, all saved references are used so the section is still useful.
 */
export function buildBibliography(markdown, references = [], style = 'APA 7', options = {}) {
  const selectedStyle = normalizeStyle(style)
  const heading = options.heading || '## References'
  const source = String(markdown || '')
  const audit = citationAudit(source, references, selectedStyle)
  const list = Array.isArray(references) ? references : []
  const selected = audit.citedIds.length
    ? audit.citedIds.map((id) => list.find((reference) => reference.id === id)).filter(Boolean)
    : list
  const entries = selected.map((reference, position) => {
    const usageIndex = audit.usages.find((usage) => usage.referenceId === reference.id)?.index
    const index = usageIndex || position + 1
    return { index, referenceId: reference.id, text: formatCitation(reference, selectedStyle, index) }
  })
  const block = [heading, '', ...entries.map((entry) => `- ${entry.text}`)].join('\n')
  return {
    markdown: replaceReferencesSection(source, block),
    entries,
    usedIds: audit.citedIds,
    unusedIds: audit.uncitedIds,
    unresolved: audit.unresolved
  }
}
