/**
 * Deterministic, local-only manuscript assessment. The score is a transparent
 * weighted summary of checks; it is not a grammar checker or an AI detector.
 */
import { analyzeDraft } from './writing.js'
import { parseMarkdown } from './documentMarkdown.js'
import { getTemplate, summarizeClaims } from './drafting.js'
import { citationAudit } from './citationEngine.js'
import { scanNumberables } from './documentNumbering.js'

export const CHECK_ORDER = [
  'draft-length', 'structure', 'citations', 'bibliography', 'uncited-sources',
  'figures', 'tables', 'cross-references', 'claim-evidence', 'readability',
  'sentence-length', 'repetition', 'fillers', 'placeholders'
]

export function qualityLabel(score) {
  if (!Number.isFinite(score) || score <= 0) return 'Not started'
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Needs work'
}

const REPORT_METRICS = [
  ['wordCount', 'Words'], ['targetProgress', 'Target progress'],
  ['sectionCount', 'Headings'], ['expectedSections', 'Expected sections'],
  ['missingSections', 'Missing sections'], ['citationCount', 'Citation usages'],
  ['unresolvedCitations', 'Unresolved citations'], ['figureCount', 'Figures'],
  ['tableCount', 'Tables'], ['uncitedReferences', 'Uncited saved sources'],
  ['supportedClaims', 'Supported claims'], ['staleClaims', 'Stale claims'],
  ['longSentences', 'Long sentences'], ['flesch', 'Flesch reading ease']
]

const REPORT_GROUPS = [
  ['fail', 'Needs attention'], ['warn', 'Review'],
  ['pass', 'Passed'], ['neutral', 'Not applicable']
]

function statusFromValue(value, warnAt, failAt) {
  if (value >= failAt) return 'fail'
  if (value >= warnAt) return 'warn'
  return 'pass'
}

/**
 * @param {{
 *   content?: string, references?: any[], assets?: any[], claims?: any[],
 *   template?: string, style?: string, targetWords?: number
 * }} input
 * @returns {any}
 */
export function assessManuscript({
  content = '', references = [], assets = [], claims = [], template = '', style = 'APA 7', targetWords = 1000
} = {}) {
  const source = String(content || '')
  const referenceList = Array.isArray(references) ? references : []
  const assetList = Array.isArray(assets) ? assets : []
  const claimList = Array.isArray(claims) ? claims : []
  const target = Math.max(1, Number(targetWords) || 1000)

  const stats = analyzeDraft(source)
  const audit = citationAudit(source, referenceList, style)
  const numberables = scanNumberables(source, assetList)
  const figures = numberables.filter((item) => item.kind === 'figure')
  const tables = numberables.filter((item) => item.kind === 'table')
  const claimSummary = summarizeClaims(claimList, source, referenceList)
  const headings = parseMarkdown(source).filter((block) => block.type === 'heading')
  const templateRecord = getTemplate(template)
  const expectedSections = (templateRecord?.sections || [])
    .filter((section) => !/^(title|chapter title)$/i.test(section))
  const presentSections = headings.map((heading) => String(heading.text || '').toLowerCase())
  const missingSections = expectedSections.filter((section) => {
    const needle = section.toLowerCase()
    return !presentSections.some((present) => present.includes(needle) || needle.includes(present))
  })

  const tokenMatches = [...source.matchAll(/@(fig|tbl):([A-Za-z0-9_-]+)/gi)]
  const knownKeys = new Set(numberables.map((item) => `${item.kind === 'figure' ? 'fig' : 'tbl'}:${item.key}`.toLowerCase()))
  const unresolvedRefs = [...new Set(tokenMatches
    .filter((match) => !knownKeys.has(`${match[1]}:${match[2]}`.toLowerCase()))
    .map((match) => `@${match[1]}:${match[2]}`))]

  const placeholderCount = (source.match(/\b(?:TODO|FIXME|TBD|XXX)\b|\?\?\?|lorem ipsum/gi) || []).length
  const isEmpty = !source.trim()
  const checks = []
  const add = (id, label, status, detail, weight) => {
    const finalStatus = isEmpty ? 'neutral' : status
    checks.push({
      id, label, status: finalStatus,
      detail: isEmpty ? 'No draft content yet.' : detail,
      weight,
      severity: finalStatus === 'fail' ? 'error' : finalStatus === 'warn' ? 'warning' : 'info'
    })
  }

  const targetProgress = Math.min(100, (stats.wordCount / target) * 100)
  add('draft-length', 'Word target',
    stats.wordCount === 0 ? 'neutral' : targetProgress >= 100 ? 'pass' : targetProgress >= 50 ? 'warn' : 'fail',
    stats.wordCount === 0 ? 'No words yet.' : `${stats.wordCount.toLocaleString()} / ${target.toLocaleString()} words (${Math.round(targetProgress)}%).`, 10)

  add('structure', 'Expected sections',
    !expectedSections.length ? 'neutral' : !missingSections.length ? 'pass' : missingSections.length <= 2 ? 'warn' : 'fail',
    !expectedSections.length ? 'No template selected for this draft.' : !missingSections.length ? 'All template sections are present.' : `Missing: ${missingSections.join(', ')}.`, 10)

  add('citations', 'In-text citations',
    !audit.usageCount && !audit.unresolved.length ? 'neutral' : audit.unresolved.length ? 'fail' : audit.usageCount > 0 ? 'pass' : 'warn',
    audit.unresolved.length ? `Unresolved token(s): ${audit.unresolved.join(', ')}.` : `${audit.usageCount} citation usage(s) found.`, 12)

  add('bibliography', 'Reference list',
    !referenceList.length ? 'neutral' : !audit.hasBibliography && audit.usageCount > 0 ? 'fail' : audit.hasBibliography && audit.uncitedIds.length && audit.usageCount ? 'warn' : audit.hasBibliography ? 'pass' : 'neutral',
    !referenceList.length ? 'No saved references in the library.' : !audit.hasBibliography ? 'No References heading yet.' : `${referenceList.length - audit.uncitedIds.length} of ${referenceList.length} saved sources cited.`, 8)

  add('uncited-sources', 'Uncited library items',
    !referenceList.length ? 'neutral' : audit.uncitedIds.length === 0 ? 'pass' : audit.uncitedIds.length <= 2 ? 'warn' : 'fail',
    !referenceList.length ? 'Nothing to audit.' : `${audit.uncitedIds.length} saved source(s) are not cited in this draft.`, 5)

  add('figures', 'Figure captions',
    !figures.length ? 'neutral' : figures.every((item) => item.hasCaption) ? 'pass' : 'warn',
    !figures.length ? 'No figures inserted.' : `${figures.filter((item) => item.hasCaption).length} of ${figures.length} figure(s) have captions.`, 6)

  add('tables', 'Table captions',
    !tables.length ? 'neutral' : tables.every((item) => item.hasCaption) ? 'pass' : 'warn',
    !tables.length ? 'No tables inserted.' : `${tables.filter((item) => item.hasCaption).length} of ${tables.length} table(s) have captions.`, 6)

  add('cross-references', 'Figure/table references',
    !tokenMatches.length ? 'neutral' : unresolvedRefs.length ? 'fail' : 'pass',
    !tokenMatches.length ? 'No @fig/@tbl tokens used.' : unresolvedRefs.length ? `Missing target(s): ${unresolvedRefs.join(', ')}.` : `${tokenMatches.length} cross-reference(s) resolve.`, 6)

  add('claim-evidence', 'Claim evidence',
    claimSummary.total === 0 ? 'neutral' : claimSummary.stale > 0 ? 'fail' : claimSummary.supported === claimSummary.total ? 'pass' : 'warn',
    claimSummary.total === 0 ? 'No claims tracked.' : `${claimSummary.supported}/${claimSummary.total} supported${claimSummary.stale ? `, ${claimSummary.stale} stale` : ''}.`, 10)

  add('readability', 'Readability',
    stats.flesch === null ? 'neutral' : stats.flesch >= 50 ? 'pass' : stats.flesch >= 30 ? 'warn' : 'fail',
    stats.flesch === null ? 'Not enough text.' : `${Math.round(stats.flesch)} · ${stats.flesch >= 60 ? 'plain English' : stats.flesch >= 30 ? 'review sentence length' : 'dense prose'}.`, 8)

  add('sentence-length', 'Long sentences',
    stats.longSentences.length === 0 ? 'pass' : stats.longSentences.length <= 3 ? 'warn' : 'fail',
    stats.longSentences.length ? `${stats.longSentences.length} sentence(s) over 30 words.` : 'No sentences over 30 words.', 8)

  add('repetition', 'Repeated terms', statusFromValue(stats.repeated.length, 1, 4),
    stats.repeated.length ? `${stats.repeated.length} repeated term(s) above threshold.` : 'No repeated terms above threshold.', 5)

  add('fillers', 'Filler phrases', statusFromValue(stats.fillers.length, 1, 4),
    stats.fillers.length ? `${stats.fillers.length} filler phrase(s) detected.` : 'No filler phrases detected.', 5)

  add('placeholders', 'Placeholders', placeholderCount === 0 ? 'pass' : placeholderCount <= 2 ? 'warn' : 'fail',
    placeholderCount ? `${placeholderCount} TODO/FIXME/TBD marker(s) remain.` : 'No placeholders remain.', 6)

  checks.sort((a, b) => CHECK_ORDER.indexOf(a.id) - CHECK_ORDER.indexOf(b.id))
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0)
  const allNeutral = checks.every((check) => check.status === 'neutral')
  const penalty = checks.reduce((sum, check) => sum + (check.status === 'fail' ? check.weight : check.status === 'warn' ? check.weight / 2 : 0), 0)
  const score = allNeutral ? 0 : Math.max(0, Math.min(100, Math.round(100 * (1 - penalty / totalWeight))))

  return {
    score,
    grade: qualityLabel(score),
    checks,
    metrics: {
      wordCount: stats.wordCount,
      targetProgress: Math.round(targetProgress),
      sectionCount: headings.length,
      expectedSections: expectedSections.length,
      missingSections,
      citationCount: audit.usageCount,
      unresolvedCitations: audit.unresolved.length,
      figureCount: figures.length,
      tableCount: tables.length,
      uncitedReferences: audit.uncitedIds.length,
      supportedClaims: claimSummary.supported,
      staleClaims: claimSummary.stale,
      longSentences: stats.longSentences.length,
      flesch: stats.flesch
    },
    note: 'Heuristic checks only. Always verify scientific meaning and formatting yourself.'
  }
}

function reportCell(value) {
  return String(value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function reportMetric(key, value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None'
  if (value === '' || value === null || value === undefined) return '—'
  if (typeof value === 'number' && !Number.isFinite(value)) return '—'
  if (key === 'targetProgress') return `${value}%`
  if (key === 'flesch') return String(Math.round(value))
  return String(value)
}

function reportList(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

/**
 * Build a portable Markdown report from an assessment. No clock, network or
 * hidden state: the same assessment and options always produce the same report.
 */
export function buildQualityReport(result = {}, options = {}) {
  const assessment = result && typeof result === 'object' ? result : {}
  const checks = Array.isArray(assessment.checks) ? assessment.checks : []
  const metrics = assessment.metrics && typeof assessment.metrics === 'object' ? assessment.metrics : {}
  const score = Number.isFinite(assessment.score) ? assessment.score : 0
  const grade = assessment.grade || qualityLabel(score)
  const targetWords = Math.max(1, Number(options.targetWords) || 1000)
  const unresolvedCitations = reportList(options.unresolvedCitations)
  const unresolvedReferences = reportList(options.unresolvedReferences)

  const lines = [
    '# Manuscript quality report',
    '',
    `- **Draft:** ${reportCell(options.title || 'Untitled draft')}`,
    `- **Template:** ${reportCell(options.template || 'Not set')}`,
    `- **Citation style:** ${reportCell(options.style || 'APA 7')}`,
    `- **Word target:** ${targetWords.toLocaleString()}`,
    `- **Status:** ${reportCell(grade)} (${score}/100)`,
    '',
    '## Metrics',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    ...REPORT_METRICS.map(([key, label]) => `| ${label} | ${reportCell(reportMetric(key, metrics[key]))} |`),
    '',
    '## Checks',
    ''
  ]

  for (const [status, label] of REPORT_GROUPS) {
    lines.push(`### ${label}`, '')
    const groupChecks = checks.filter((check) => check && check.status === status)
    if (!groupChecks.length) lines.push('None.', '')
    else {
      for (const check of groupChecks) {
        lines.push(`- **${reportCell(check.label || check.id || 'Check')}** — ${reportCell(check.detail || '')}`)
      }
      lines.push('')
    }
  }

  if (unresolvedCitations.length || unresolvedReferences.length) {
    lines.push('## Unresolved tokens', '')
    for (const key of unresolvedCitations) lines.push(`- Citation token: \`${key}\``)
    for (const token of unresolvedReferences) lines.push(`- Figure/table reference: \`${token}\``)
    lines.push('')
  }

  lines.push(
    '## Scope',
    '',
    'Heuristic checks only. This report cannot verify scientific meaning, grammar or formatting. Generated locally; no data leaves this device.'
  )
  return lines.join('\n')
}
