const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'were', 'have', 'been', 'their', 'which', 'these',
  'those', 'there', 'where', 'when', 'what', 'into', 'than', 'then', 'also', 'such', 'using', 'used', 'was',
  'are', 'but', 'not', 'can', 'may', 'our', 'its', 'has', 'had', 'all', 'any', 'per', 'via', 'due', 'more'
])

const FILLERS = [
  'very', 'really', 'quite', 'actually', 'basically', 'simply', 'just', 'rather', 'somewhat', 'fairly',
  'in order to', 'due to the fact that', 'it is important to note that', 'a lot of', 'lots of',
  'in terms of', 'with regard to', 'it should be noted that', 'needless to say', 'at the end of the day'
]

function countSyllables(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 0
  if (clean.length <= 3) return 1
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) || []).length)
}

/**
 * Local, rule-based writing analysis. Not an AI detector and not a substitute for human editing.
 * @param {string} text
 * @returns {any}
 */
export function analyzeDraft(text) {
  const source = String(text || '')
  const words = source.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) || []
  const wordCount = words.length
  const sentences = source.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter((sentence) => /[A-Za-z0-9]/.test(sentence))
  const sentenceCount = Math.max(sentences.length, wordCount ? 1 : 0)
  const paragraphs = source.split(/\n\s*\n/).filter((paragraph) => /[A-Za-z0-9]/.test(paragraph)).length
  const characters = source.length
  const charactersNoSpaces = source.replace(/\s/g, '').length
  const averageSentenceLength = sentenceCount ? wordCount / sentenceCount : 0
  const longSentences = sentences
    .map((sentence, index) => ({ index: index + 1, words: (sentence.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) || []).length, text: sentence }))
    .filter((sentence) => sentence.words >= 30)
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0)
  const flesch = wordCount && sentenceCount ? 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllables / wordCount) : null
  const readingMinutes = wordCount ? wordCount / 220 : 0

  const counts = new Map()
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[’']s$/, '')
    if (normalized.length < 4 || STOP_WORDS.has(normalized)) continue
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }
  const repeated = [...counts.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const lower = source.toLowerCase()
  const fillers = FILLERS
    .map((phrase) => ({ phrase, count: (lower.match(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const passiveMatches = source.match(/\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ed|shown|found|made|given|taken|written|seen|known|used|observed|reported)\b/gi) || []
  const adverbMatches = source.match(/\b[A-Za-z]{4,}ly\b/g) || []
  const contractionMatches = source.match(/\b\w+(?:n't|'re|'ve|'ll|'d|'m)\b/gi) || []
  const firstPersonMatches = source.match(/\b(?:I|we|our|my|us)\b/gi) || []
  const citationMatches = source.match(/\([A-Z][A-Za-z’'\-]+(?:\s+(?:et al\.?|&|and)\s+[A-Za-z’'\-]+)?,\s*(?:n\.d\.|\d{4}[a-z]?)\)/g) || []
  const headingCount = source.split('\n').filter((line) => /^#{1,6}\s+\S/.test(line.trim())).length

  return {
    wordCount,
    sentenceCount,
    paragraphCount: paragraphs,
    characters,
    charactersNoSpaces,
    averageSentenceLength,
    longSentences,
    repeated,
    fillers,
    passiveMatches,
    passiveCount: passiveMatches.length,
    adverbCount: adverbMatches.length,
    contractionCount: contractionMatches.length,
    firstPersonCount: firstPersonMatches.length,
    citationCount: citationMatches.length,
    headingCount,
    flesch,
    readingMinutes,
    sentences
  }
}

export function readabilityLabel(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return 'Not enough text'
  if (score >= 80) return 'Very easy'
  if (score >= 60) return 'Plain English'
  if (score >= 50) return 'Fairly difficult'
  if (score >= 30) return 'Difficult'
  return 'Very difficult'
}
