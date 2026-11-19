/** Tiny word-level diff for reviewing local/Ollama rewrites without a dependency. */

const MAX_LCS_CELLS = 1_000_000

function tokenize(text) {
  return String(text || '').match(/\s+|[^\s]+/g) || []
}

function tokenDiff(before, after) {
  const rows = before.length + 1
  const columns = after.length + 1
  if (rows * columns > MAX_LCS_CELLS) {
    return [
      ...before.map((value) => ({ type: 'remove', value })),
      ...after.map((value) => ({ type: 'add', value }))
    ]
  }
  const table = Array.from({ length: rows }, () => new Uint32Array(columns))
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const operations = []
  let i = 0
  let j = 0
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      operations.push({ type: 'equal', value: before[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      operations.push({ type: 'remove', value: before[i++] })
    } else {
      operations.push({ type: 'add', value: after[j++] })
    }
  }
  while (i < before.length) operations.push({ type: 'remove', value: before[i++] })
  while (j < after.length) operations.push({ type: 'add', value: after[j++] })
  return operations
}

/**
 * Build reviewable change groups. Every group replaces one contiguous span of
 * the original text, so accepting/rejecting one group never shifts another.
 */
export function buildRewriteDiff(original, rewritten) {
  const beforeTokens = tokenize(original)
  const afterTokens = tokenize(rewritten)
  const groups = []
  let beforeIndex = 0
  let current = null

  const close = () => {
    if (!current || (!current.beforeTokens && !current.afterTokens)) return
    current.id = `change_${groups.length + 1}`
    current.before = current.beforeTokens.join('')
    current.after = current.afterTokens.join('')
    delete current.beforeTokens
    delete current.afterTokens
    groups.push(current)
    current = null
  }

  for (const operation of tokenDiff(beforeTokens, afterTokens)) {
    if (operation.type === 'equal') {
      close()
      beforeIndex++
      continue
    }
    if (!current) current = { start: beforeIndex, beforeCount: 0, afterCount: 0, beforeTokens: [], afterTokens: [] }
    if (operation.type === 'remove') {
      current.beforeTokens.push(operation.value)
      current.beforeCount++
      beforeIndex++
    } else {
      current.afterTokens.push(operation.value)
      current.afterCount++
    }
  }
  close()
  return {
    original: String(original || ''),
    rewritten: String(rewritten || ''),
    beforeTokens,
    groups
  }
}

/** decisions maps group id -> boolean; missing ids are treated as accepted. */
export function applyRewriteDecisions(diff, decisions = {}) {
  if (!diff || !Array.isArray(diff.beforeTokens)) return ''
  let output = ''
  let cursor = 0
  for (const group of diff.groups) {
    output += diff.beforeTokens.slice(cursor, group.start).join('')
    output += decisions[group.id] === false ? group.before : group.after
    cursor = group.start + group.beforeCount
  }
  output += diff.beforeTokens.slice(cursor).join('')
  return output
}

export function summarizeRewriteDiff(diff, decisions = {}) {
  const groups = diff?.groups || []
  const accepted = groups.filter((group) => decisions[group.id] !== false).length
  return {
    total: groups.length,
    accepted,
    rejected: groups.length - accepted
  }
}
