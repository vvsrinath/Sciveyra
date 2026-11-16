import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Redo2, RotateCcw, Save, Trash2, Undo2, X } from 'lucide-react'
import { Button, Callout, IconButton, Input } from '../../components/ui'
import { parseNumeric, retypeDataset } from '../../lib/parse.js'
import type { Column, Dataset, DataRow } from '../../types'

type Props = {
  dataset: Dataset
  onSave: (dataset: Dataset) => Promise<void> | void
  onDelete: () => void
  onDuplicate: () => void
  onClose: () => void
}

const PAGE_SIZE = 50

export default function DataTableEditor({ dataset, onSave, onDelete, onDuplicate, onClose }: Props) {
  const [draft, setDraft] = useState<Dataset>(dataset)
  const [undoStack, setUndoStack] = useState<Dataset[]>([])
  const [redoStack, setRedoStack] = useState<Dataset[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [newColumn, setNewColumn] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const addColumnRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(dataset)
    setUndoStack([])
    setRedoStack([])
    setSelected(new Set())
    setPage(0)
    setDirty(false)
  }, [dataset])

  useEffect(() => {
    if (showAddColumn) setTimeout(() => addColumnRef.current?.focus(), 20)
  }, [showAddColumn])

  const commit = (next: Dataset) => {
    setUndoStack((stack) => [...stack.slice(-49), draft])
    setRedoStack([])
    setDraft(next)
    setDirty(true)
  }

  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack(undoStack.slice(0, -1))
    setRedoStack((stack) => [...stack, draft])
    setDraft(previous)
    setDirty(true)
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(redoStack.slice(0, -1))
    setUndoStack((stack) => [...stack, draft])
    setDraft(next)
    setDirty(true)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const totalPages = Math.max(1, Math.ceil(draft.rows.length / PAGE_SIZE))
  const visibleRows = draft.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const invalidCells = useMemo(() => {
    const invalid = new Set<string>()
    for (const [rowIndex, row] of draft.rows.entries()) {
      for (const column of draft.columns) {
        const value = row[column.key]
        if (column.type === 'numeric' && value !== null && typeof value !== 'number' && String(value).trim() !== '' && parseNumeric(value) === null) {
          invalid.add(`${rowIndex}:${column.key}`)
        }
      }
    }
    return invalid
  }, [draft])

  const updateCell = (rowIndex: number, column: Column, raw: string) => {
    const value = raw.trim()
    const nextValue = value === '' ? null : column.type === 'numeric' ? (parseNumeric(value) ?? value) : value
    const current = draft.rows[rowIndex]
    if (current?.[column.key] === nextValue) return
    const rows = draft.rows.map((row, index) => (index === rowIndex ? { ...row, [column.key]: nextValue } : row))
    commit({ ...draft, rows, rowCount: rows.length, updatedAt: new Date().toISOString() })
  }

  const addRow = () => {
    const blank: DataRow = {}
    for (const column of draft.columns) blank[column.key] = null
    const rows = [...draft.rows, blank]
    commit({ ...draft, rows, rowCount: rows.length })
    setPage(Math.floor((rows.length - 1) / PAGE_SIZE))
  }

  const deleteRows = () => {
    if (!selected.size) return
    const rows = draft.rows.filter((_, index) => !selected.has(index))
    commit({ ...draft, rows: rows.length ? rows : [blankRow(draft.columns)], rowCount: rows.length || 1 })
    setSelected(new Set())
    setPage((current) => Math.min(current, Math.max(0, Math.ceil((rows.length || 1) / PAGE_SIZE) - 1)))
  }

  const renameColumn = (key: string, name: string) => {
    const columns = draft.columns.map((column) => (column.key === key ? { ...column, name: name || column.name } : column))
    commit({ ...draft, columns })
  }

  const addColumn = () => {
    const name = newColumn.trim() || `Column ${draft.columns.length + 1}`
    let index = draft.columns.length
    let key = `c${index}`
    while (draft.columns.some((column) => column.key === key)) { index += 1; key = `c${index}` }
    const columns = [...draft.columns, { key, name, type: 'text' as const }]
    const rows = draft.rows.map((row) => ({ ...row, [key]: null }))
    commit({ ...draft, columns, rows, columnCount: columns.length })
    setNewColumn('')
    setShowAddColumn(false)
  }

  const removeColumn = (key: string) => {
    if (draft.columns.length <= 1) return
    const columns = draft.columns.filter((column) => column.key !== key)
    const rows = draft.rows.map((row) => {
      const next = { ...row }
      delete next[key]
      return next
    })
    commit({ ...draft, columns, rows, columnCount: columns.length })
  }

  const restoreOriginal = () => {
    if (!draft.original) return
    commit(retypeDataset({ ...draft, columns: draft.original.columns, rows: draft.original.rows.map((row) => ({ ...row })) }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const rebuilt = retypeDataset(draft)
      await onSave(rebuilt)
      setDraft(rebuilt)
      setDirty(false)
      setUndoStack([])
      setRedoStack([])
    } finally {
      setSaving(false)
    }
  }

  const toggleSelected = (index: number) => {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={addRow} icon={<Plus size={13} />}>Add row</Button>
      <Button size="sm" onClick={() => setShowAddColumn(true)} icon={<Plus size={13} />}>Add column</Button>
      <Button size="sm" variant="ghost" onClick={undo} disabled={!undoStack.length} icon={<Undo2 size={13} />} title="Undo (Ctrl+Z)">Undo</Button>
      <Button size="sm" variant="ghost" onClick={redo} disabled={!redoStack.length} icon={<Redo2 size={13} />} title="Redo (Ctrl+Shift+Z)">Redo</Button>
      <Button size="sm" variant="danger" onClick={deleteRows} disabled={!selected.size} icon={<Trash2 size={13} />}>Delete rows ({selected.size})</Button>
      <div className="flex-1" />
      <Button size="sm" variant="ghost" onClick={onDuplicate}>Duplicate dataset</Button>
      <Button size="sm" variant="ghost" onClick={onDelete} icon={<Trash2 size={13} />}>Delete dataset</Button>
      <Button size="sm" onClick={save} disabled={saving} icon={<Save size={13} />}>{saving ? 'Saving…' : 'Save changes'}</Button>
      <IconButton label="Close data editor" onClick={onClose}><X size={16} /></IconButton>
    </div>

    {showAddColumn && <div className="flex items-end gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="flex-1">
        <label htmlFor="new-column-name" className="mb-1 block text-[10px] font-bold uppercase text-slate-500">New column name</label>
        <Input id="new-column-name" ref={addColumnRef} value={newColumn} onChange={(event) => setNewColumn(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addColumn()} placeholder="e.g. Temperature (°C)" />
      </div>
      <Button size="sm" onClick={addColumn}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)}>Cancel</Button>
    </div>}

    {draft.original && <Callout tone="info">This dataset keeps a snapshot of the original import. <button type="button" className="font-bold underline" onClick={restoreOriginal}><RotateCcw size={12} className="mr-1 inline" />Restore original import</button></Callout>}
    {dirty && <Callout tone="warning">You have unsaved table edits. Save changes before leaving this editor.</Callout>}
    {invalidCells.size > 0 && <Callout tone="warning">{invalidCells.size} cell(s) in numeric columns contain non-numeric text. Replace them with a number or leave the cell empty. Invalid values are kept for editing but will make that column mixed-type after saving.</Callout>}

    <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
          <tr>
            <th className="w-8 border-b border-slate-200 p-1.5 dark:border-slate-700"><input type="checkbox" aria-label="Select all rows on this page" checked={visibleRows.length > 0 && visibleRows.every((_, index) => selected.has(page * PAGE_SIZE + index))} onChange={(event) => {
              const next = new Set(selected)
              visibleRows.forEach((_, index) => {
                const rowIndex = page * PAGE_SIZE + index
                if (event.target.checked) next.add(rowIndex)
                else next.delete(rowIndex)
              })
              setSelected(next)
            }} /></th>
            <th className="w-10 border-b border-slate-200 p-1.5 text-slate-400 dark:border-slate-700">#</th>
            {draft.columns.map((column) => <th key={column.key} className="min-w-[130px] border-b border-slate-200 p-1.5 dark:border-slate-700">
              <div className="flex items-center gap-1">
                <input
                  className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-1 text-[11px] font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-blue-400 dark:text-slate-200 dark:hover:border-slate-600"
                  value={column.name}
                  aria-label={`Column name ${column.name}`}
                  onChange={(event) => renameColumn(column.key, event.target.value)}
                />
                <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{column.type}</span>
                {draft.columns.length > 1 && <button type="button" className="text-slate-400 hover:text-red-500" aria-label={`Remove column ${column.name}`} onClick={() => removeColumn(column.key)}><X size={11} /></button>}
              </div>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, visibleIndex) => {
            const rowIndex = page * PAGE_SIZE + visibleIndex
            return <tr key={rowIndex} className={selected.has(rowIndex) ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-900/60'}>
              <td className="border-b border-slate-100 p-1.5 dark:border-slate-800"><input type="checkbox" aria-label={`Select row ${rowIndex + 1}`} checked={selected.has(rowIndex)} onChange={() => toggleSelected(rowIndex)} /></td>
              <td className="border-b border-slate-100 p-1.5 text-slate-400 dark:border-slate-800">{rowIndex + 1}</td>
              {draft.columns.map((column) => {
                const invalid = invalidCells.has(`${rowIndex}:${column.key}`)
                return <td key={column.key} className="border-b border-slate-100 p-0.5 dark:border-slate-800">
                  <input
                    key={`${rowIndex}-${column.key}-${String(row[column.key] ?? '')}`}
                    defaultValue={row[column.key] === null ? '' : String(row[column.key])}
                    aria-invalid={invalid}
                    aria-label={`${column.name}, row ${rowIndex + 1}`}
                    title={invalid ? 'This numeric column contains text. Replace with a number or leave empty.' : undefined}
                    onBlur={(event) => updateCell(rowIndex, column, event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
                    className={`h-8 w-full rounded border bg-transparent px-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-400 dark:text-slate-200 ${invalid ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-transparent'}`}
                  />
                </td>
              })}
            </tr>
          })}
        </tbody>
      </table>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
      <span>{draft.rows.length.toLocaleString()} rows · {draft.columns.length} columns · showing rows {draft.rows.length ? page * PAGE_SIZE + 1 : 0}–{Math.min(draft.rows.length, (page + 1) * PAGE_SIZE)}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} icon={<ChevronLeft size={13} />}>Previous</Button>
        <span>Page {page + 1} / {totalPages}</span>
        <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next <ChevronRight size={13} /></Button>
      </div>
    </div>
    {draft.warnings?.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <b>Import notes:</b>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">{draft.warnings.slice(0, 12).map((warning: string, index: number) => <li key={index}>{warning}</li>)}</ul>
    </div>}
  </div>
}

function blankRow(columns: Column[]): DataRow {
  const row: DataRow = {}
  for (const column of columns) row[column.key] = null
  return row
}
