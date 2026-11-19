import { analyzeDraft, readabilityLabel } from './writing.js'

export const REWRITE_PRESETS = [
  {
    id: 'natural',
    label: 'Natural',
    description: 'Read like a careful human editor: plainer phrases, less repetition, smoother rhythm.',
    prompt: 'Make the prose sound natural and human while staying academically accurate. Vary rhythm gently and remove formulaic phrasing.'
  },
  {
    id: 'academic',
    label: 'Academic',
    description: 'Keep formal scientific tone; remove only obvious wordiness and opacity.',
    prompt: 'Preserve a formal scientific register. Reduce wordiness and clarify dense phrases without casualising the text.'
  },
  {
    id: 'concise',
    label: 'Concise',
    description: 'Cut fillers and tautologies while preserving every technical claim.',
    prompt: 'Tighten the text aggressively. Delete fillers, tautologies and needless hedging, but keep all methods, values and qualifications.'
  }
]

export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'

const PRESET_IDS = new Set(REWRITE_PRESETS.map((preset) => preset.id))

const SENSITIVE_PATTERNS = [
  /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi,
  /\b10\.\d{4,9}\/[^\s,;)]+/gi,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
  /\([^()]*\b(?:19|20)\d{2}[a-z]?\b[^()]*\)/g,
  /\[(?:\[)?\d+(?:\s*[,–-]\s*\d+)*(?:\]\])?\]?/g,
  /\b(?:e\.g|i\.e|etc|vs|Fig|Eq|et al)\./gi,
  /\b\d+(?:[.,]\d+)*(?:\s?(?:%|°C|°F|kg|g|mg|µg|ng|nm|µm|mm|cm|m|s|ms|min|h|mM|µM|nM|kV|kW|V|A|Hz|rpm|±|×))?/g
]
const SENSITIVE_RE = new RegExp(SENSITIVE_PATTERNS.map((pattern) => pattern.source).join('|'), 'gi')
const TOKEN_OPEN = '\uE000'
const TOKEN_CLOSE = '\uE001'

const CORE_RULES = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bis able to\b/gi, 'can'],
  [/\bare able to\b/gi, 'can'],
  [/\bmade the observation that\b/gi, 'observed that'],
  [/\bperformed an analysis of\b/gi, 'analysed'],
  [/\bconducted an investigation (?:of|into)\b/gi, 'studied'],
  [/\bin the event that\b/gi, 'if'],
  [/\bwith regard to\b/gi, 'regarding'],
  [/\bwith respect to\b/gi, 'regarding'],
  [/\ba number of\b/gi, 'several'],
  [/\bthe majority of\b/gi, 'most'],
  [/\butili[sz]e\b/gi, 'use'],
  [/\butili[sz]es\b/gi, 'uses'],
  [/\butili[sz]ed\b/gi, 'used'],
  [/\butili[sz]ing\b/gi, 'using']
]

const EXTRA_RULES = [
  [/\bit is important to note that\b/gi, ''],
  [/\bit should be noted that\b/gi, ''],
  [/\bit is worth noting that\b/gi, ''],
  [/\bneedless to say,?\s*/gi, ''],
  [/\bas a matter of fact,?\s*/gi, ''],
  [/\ba lot of\b/gi, 'many'],
  [/\blots of\b/gi, 'many'],
  [/\bin terms of\b/gi, 'regarding'],
  [/\bat the end of the day,?\s*/gi, ''],
  [/\bvery\b/gi, ''],
  [/\breally\b/gi, ''],
  [/\bquite\b/gi, ''],
  [/\bactually\b/gi, ''],
  [/\bbasically\b/gi, ''],
  [/\bliterally\b/gi, ''],
  [/\bsimply\b/gi, ''],
  [/\bjust\b/gi, '']
]

const PASSIVE_PRESENT = {
  measured: 'measures', observed: 'observes', analysed: 'analyses', analyzed: 'analyzes',
  calculated: 'calculates', obtained: 'obtains', performed: 'performs', conducted: 'conducts',
  reported: 'reports', found: 'finds', shown: 'shows', used: 'uses', made: 'makes',
  taken: 'takes', given: 'gives', written: 'writes', seen: 'sees', known: 'knows',
  identified: 'identifies', determined: 'determines', compared: 'compares', tested: 'tests'
}
const PASSIVE_PAST = {
  measured: 'measured', observed: 'observed', analysed: 'analysed', analyzed: 'analyzed',
  calculated: 'calculated', obtained: 'obtained', performed: 'performed', conducted: 'conducted',
  reported: 'reported', found: 'found', shown: 'showed', used: 'used', made: 'made',
  taken: 'took', given: 'gave', written: 'wrote', seen: 'saw', known: 'knew',
  identified: 'identified', determined: 'determined', compared: 'compared', tested: 'tested'
}
const PASSIVE_RE = new RegExp(
  '^([\\s\\S]*?)\\b(was|were|is|are)\\s+([a-z]+ed|shown|found|made|given|taken|written|seen|known|used|observed|reported)\\s+by\\s+' +
  "([A-Za-z][\\w'-]*(?:\\s+(?!to\\b|in\\b|for\\b|from\\b|that\\b|which\\b|by\\b|and\\b|but\\b|because\\b|with\\b|using\\b|during\\b|after\\b|before\\b|of\\b|on\\b|at\\b|as\\b)[A-Za-z][\\w'-]*){0,3})" +
  '([\\s\\S]*)$',
  'i'
)

const REPEATED_WORDS = {
  result: 'finding', results: 'findings', show: 'demonstrate', shows: 'demonstrates',
  showed: 'demonstrated', method: 'approach', methods: 'approaches', use: 'employ',
  uses: 'employs', used: 'employed', important: 'notable', significant: 'marked',
  increase: 'rise', increases: 'rises', decrease: 'fall', decreases: 'falls',
  improve: 'enhance', improves: 'enhances', observe: 'note', observed: 'noted'
}

function matchCase(source, replacement) {
  if (!replacement) return ''
  if (/^[A-Z]/.test(source)) return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  return replacement
}

function protectSensitive(text) {
  const tokens = []
  const protectedText = String(text).replace(SENSITIVE_RE, (match) => {
    tokens.push(match)
    return `${TOKEN_OPEN}${tokens.length - 1}${TOKEN_CLOSE}`
  })
  return { text: protectedText, tokens }
}

function restoreSensitive(text, tokens) {
  return String(text).replace(new RegExp(`${TOKEN_OPEN}(\\d+)${TOKEN_CLOSE}`, 'g'), (_, index) => tokens[Number(index)] ?? '')
}

function applyRules(sentence, preset) {
  let output = sentence
  const rules = preset === 'academic' ? CORE_RULES : [...CORE_RULES, ...EXTRA_RULES]
  for (const [pattern, replacement] of rules) {
    output = output.replace(pattern, (match) => matchCase(match, typeof replacement === 'function' ? replacement(match) : replacement))
  }
  return output
}

function reducePassiveVoice(sentence) {
  const match = String(sentence).match(PASSIVE_RE)
  if (!match) return sentence
  const [, lead, aux, participle, agent, tail] = match
  const key = participle.toLowerCase()
  const verb = /^(?:is|are)$/i.test(aux) ? PASSIVE_PRESENT[key] : PASSIVE_PAST[key]
  const subject = lead.trim()
  if (!verb || !subject || !agent.trim()) return sentence
  const loweredSubject = subject.charAt(0).toLowerCase() + subject.slice(1)
  const raisedAgent = agent.charAt(0).toUpperCase() + agent.slice(1)
  return `${raisedAgent} ${verb} ${loweredSubject}${tail || ''}`
}

function splitSentences(block) {
  return String(block).match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || [String(block)].filter(Boolean)
}

function varyRepeatedWords(text, preset) {
  if (preset === 'academic') return text
  let output = text
  for (const [word, alternative] of Object.entries(REPEATED_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi')
    const count = (output.match(pattern) || []).length
    if (count < 2) continue
    let seen = 0
    output = output.replace(pattern, (match) => {
      seen += 1
      return seen === 1 ? match : matchCase(match, alternative)
    })
  }
  return output
}

function varySentenceLength(text) {
  return String(text)
    .replace(/^(.{30,}?);\s+(.{12,}?)(?=\s|$)/gm, (match, first, second) => `${first.trim()}. ${second.charAt(0).toUpperCase() + second.slice(1)}`)
    .replace(/^(.{34,}?),\s+(but|however|whereas|while)\s+(.+)$/gim, (match, first, connector, rest) => {
      const lead = connector.toLowerCase() === 'however' ? 'However' : connector.charAt(0).toUpperCase() + connector.slice(1)
      return `${first.trim()}. ${lead} ${rest}`
    })
}

function cleanup(text) {
  return String(text)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
}

function rewriteBlock(block, preset) {
  const sentences = splitSentences(block).map((sentence) => {
    const match = String(sentence).match(/^(\s*)([\s\S]*?)(\s*)$/)
    if (!match) return sentence
    const [, leading, core, trailing] = match
    let next = applyRules(core, preset)
    if (preset !== 'academic') next = reducePassiveVoice(next)
    return `${leading}${next}${trailing}`
  })
  let output = varyRepeatedWords(sentences.join(''), preset)
  if (preset !== 'academic') output = varySentenceLength(output)
  return output
}

/**
 * Deterministic, local paragraph rewriting. No network calls and no data upload.
 * @param {string} text
 * @param {{preset?: string}} [options]
 * @returns {string}
 */
export function rewriteParagraph(text, options = {}) {
  const original = String(text || '')
  if (!original.trim()) return ''
  const preset = PRESET_IDS.has(options.preset) ? options.preset : 'natural'
  const protectedText = protectSensitive(original)
  const rewritten = protectedText.text
    .split(/(\n\s*\n|\n)/)
    .map((part) => (/^\s*$/.test(part) ? part : rewriteBlock(part, preset)))
    .join('')
  return cleanup(restoreSensitive(rewritten, protectedText.tokens))
}

/** Human-readable analysis used by the rewriter panel. */
export function analyzeParagraph(text) {
  const analysis = analyzeDraft(text)
  return {
    ...analysis,
    fillerCount: (analysis.fillers || []).reduce((total, entry) => total + entry.count, 0),
    longSentenceCount: (analysis.longSentences || []).length,
    readability: readabilityLabel(analysis.flesch),
    averageWords: Math.round(analysis.averageSentenceLength * 10) / 10
  }
}

/** Compare original and rewritten paragraphs without claiming a quality score. */
export function summarizeChanges(before, after) {
  const original = analyzeDraft(before)
  const rewritten = analyzeDraft(after)
  return {
    beforeWords: original.wordCount,
    afterWords: rewritten.wordCount,
    wordDelta: rewritten.wordCount - original.wordCount,
    beforeFlesch: original.flesch,
    afterFlesch: rewritten.flesch,
    fillersRemoved: Math.max(0, original.fillers.reduce((sum, entry) => sum + entry.count, 0) - rewritten.fillers.reduce((sum, entry) => sum + entry.count, 0)),
    passiveReduction: Math.max(0, original.passiveCount - rewritten.passiveCount)
  }
}

export function normalizeEndpoint(value) {
  const raw = String(value || '').trim()
  if (!raw) return DEFAULT_OLLAMA_ENDPOINT
  const withProtocol = raw.includes('://') ? raw : `http://${raw}`
  let parsed
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('Enter a valid endpoint URL, for example http://localhost:11434.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http:// and https:// endpoints are supported.')
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\/api\/(?:generate|chat)$/, '')
  return `${parsed.protocol}//${parsed.host}${path === '/' ? '' : path}`
}

export function buildOllamaPrompt(text, preset = 'natural') {
  const selected = REWRITE_PRESETS.find((entry) => entry.id === preset) || REWRITE_PRESETS[0]
  return [
    'You are a careful scientific editor. Rewrite the paragraph below.',
    selected.prompt,
    'Rules:',
    '- Preserve all numbers, units, equations, chemical names, DOIs, URLs and in-text citations exactly.',
    '- Do not invent facts, citations, references or experimental results.',
    '- Keep the original language and technical meaning.',
    '- Return only the rewritten paragraph, with no preface or commentary.',
    '',
    'PARAGRAPH:',
    String(text || '').trim()
  ].join('\n')
}

/**
 * Optional self-hosted Ollama rewrite. The endpoint and model are supplied by the user and stored only in this browser.
 * @param {string} text
 * @param {{endpoint?: string, model?: string, preset?: string, signal?: AbortSignal}} [options]
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string>}
 */
export async function rewriteWithOllama(text, options = {}, fetchImpl = globalThis.fetch) {
  const source = String(text || '').trim()
  if (!source) throw new Error('Enter a paragraph before rewriting.')
  if (typeof fetchImpl !== 'function') throw new Error('This browser does not support the Fetch API.')
  const endpoint = normalizeEndpoint(options.endpoint)
  const model = String(options.model || DEFAULT_OLLAMA_MODEL).trim()
  if (!model) throw new Error('Enter an Ollama model name.')
  const response = await fetchImpl(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      model,
      prompt: buildOllamaPrompt(source, options.preset),
      stream: false,
      format: 'text',
      options: { temperature: 0.3, top_p: 0.9 }
    })
  })
  if (!response.ok) throw new Error(`Ollama returned ${response.status}. Check that the endpoint is reachable and CORS allows this origin.`)
  const payload = await response.json()
  const output = String(payload?.response || payload?.message?.content || '').trim()
  if (!output) throw new Error('Ollama returned an empty rewrite. Try another model or prompt.')
  return output
}
