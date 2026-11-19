import { describe, expect, it } from 'vitest'
import {
  canRedo, canUndo, emptyEditStack, groupVersions, initialEditStack, pushEdit, redoStack, undoStack, versionSummary
} from '../src/lib/history.js'

describe('local edit history', () => {
  it('coalesces rapid typing into one undo step', () => {
    let stack = emptyEditStack()
    stack = pushEdit(stack, 'O', { now: 1000 })
    stack = pushEdit(stack, 'On', { now: 1100 })
    stack = pushEdit(stack, 'One', { now: 1200 })
    expect(stack.present.value).toBe('One')
    expect(stack.past).toHaveLength(1)
    stack = undoStack(stack)
    expect(stack.present.value).toBe('O')
    expect(canUndo(stack)).toBe(false)
    expect(canRedo(stack)).toBe(true)
    stack = redoStack(stack)
    expect(stack.present.value).toBe('One')
  })

  it('makes the first edit of a loaded draft undoable', () => {
    const loaded = { id: 'd1', content: '' }
    let stack = initialEditStack(loaded)
    stack = pushEdit(stack, { ...loaded, content: 'First edit' }, { field: 'content' })
    expect(canUndo(stack)).toBe(true)
    stack = undoStack(stack)
    expect(stack.present.value.content).toBe('')
  })

  it('starts a new step after a pause or field change', () => {
    let stack = pushEdit(emptyEditStack(), 'One', { now: 1000 })
    stack = pushEdit(stack, 'Two', { now: 2000 })
    expect(stack.past).toHaveLength(1)
    stack = pushEdit(stack, 'Two', { field: 'title', now: 2100 })
    expect(stack.past).toHaveLength(2)
  })
})

describe('version presentation', () => {
  it('groups versions and describes deleted records', () => {
    const groups = groupVersions([
      { id: 'v2', store: 'drafts', recordId: 'd1', record: { title: 'Draft' } },
      { id: 'v1', store: 'references', recordId: 'r1', record: { title: 'Paper' }, deleted: true }
    ])
    expect(groups.map((group) => group.label)).toEqual(['Drafts', 'References'])
    expect(versionSummary(groups[1].versions[0])).toBe('Deleted Paper')
  })
})
