/** Presentation and undo/redo helpers shared by the editor and version panel. */

export const HISTORY_COLLECTION_LABELS = {
  datasets: 'Datasets',
  graphs: 'Graphs',
  figures: 'Figures',
  diagrams: 'Diagrams',
  drafts: 'Drafts',
  references: 'References',
  assets: 'Assets',
  projects: 'Projects'
}

export function collectionLabel(store) {
  return HISTORY_COLLECTION_LABELS[store] || String(store || 'Record')
}

export function recordLabel(version) {
  const record = version?.record || {}
  return record.title || record.name || record.label || version?.recordId || 'Untitled record'
}

export function versionSummary(version) {
  if (!version) return 'No saved change'
  if (version.deleted) return `Deleted ${recordLabel(version)}`
  return `Updated ${recordLabel(version)}`
}

/** Group a flat version list by collection for the global history panel. */
export function groupVersions(versions = []) {
  const groups = new Map()
  for (const version of versions) {
    const store = String(version.store || 'other')
    if (!groups.has(store)) groups.set(store, [])
    groups.get(store).push(version)
  }
  return [...groups.entries()].map(([store, entries]) => ({
    store,
    label: collectionLabel(store),
    versions: entries
  }))
}

export const MAX_EDIT_STEPS = 60

/**
 * @typedef {{ value: any, field: string, at: number }} EditEntry
 * @typedef {{ past: EditEntry[], present: EditEntry | null, future: EditEntry[] }} EditStack
 */

/** @returns {EditStack} */
export function emptyEditStack() {
  return { past: [], present: null, future: [] }
}

/** Seed a stack with the currently loaded value so the first edit is undoable. */
/** @param {any} value @returns {EditStack} */
export function initialEditStack(value) {
  return value == null ? emptyEditStack() : {
    past: [],
    present: { value, field: 'value', at: Date.now() },
    future: []
  }
}

/**
 * Add a local edit to an undo stack. Consecutive edits of the same field within
 * `coalesceMs` replace the most recent step, so ordinary typing is one undo.
 */
/** @param {EditStack | null | undefined} stack @param {any} next @returns {EditStack} */
export function pushEdit(stack, next, { field = 'value', coalesceMs = 650, now = Date.now() } = {}) {
  const base = stack && stack.present ? stack : emptyEditStack()
  if (base.present && base.present.value === next && base.present.field === field) return base
  const shouldCoalesce = base.present
    && base.present.field === field
    && now - base.present.at <= coalesceMs
    && base.past.length > 0
  const past = shouldCoalesce ? base.past : [...base.past, base.present].filter(Boolean)
  return {
    past: past.slice(-MAX_EDIT_STEPS),
    present: { value: next, field, at: now },
    future: []
  }
}

/** @param {EditStack | null | undefined} stack @returns {EditStack | null} */
export function undoStack(stack) {
  if (!stack || stack.past.length === 0) return null
  const previous = stack.past[stack.past.length - 1]
  return {
    past: stack.past.slice(0, -1),
    present: previous,
    future: [stack.present, ...stack.future].filter(Boolean)
  }
}

/** @param {EditStack | null | undefined} stack @returns {EditStack | null} */
export function redoStack(stack) {
  if (!stack || stack.future.length === 0) return null
  const [next, ...rest] = stack.future
  return {
    past: [...stack.past, stack.present].filter(Boolean),
    present: next,
    future: rest
  }
}

export function canUndo(stack) {
  return Boolean(stack && stack.past.length)
}

export function canRedo(stack) {
  return Boolean(stack && stack.future.length)
}
