import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, Download, FlaskConical,
  RefreshCw, ShieldCheck, XCircle
} from 'lucide-react'
import { Badge, Button, Callout, Card, PageHeader, ProgressBar, Tabs } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import { downloadJSON } from '../../lib/export.js'
import { FEATURE_TEST_GROUPS, runFeatureTests } from '../../lib/featureTests.js'

type TestResult = {
  id: string
  group: string
  name: string
  status: 'pass' | 'fail'
  detail: string
  durationMs: number
}
type Report = {
  ranAt: string
  environment: Record<string, boolean>
  results: TestResult[]
  summary: { total: number; passed: number; failed: number }
}
type Filter = 'all' | 'pass' | 'fail'

const CAPABILITY_LABELS: Record<string, string> = {
  blob: 'Blob export',
  objectUrl: 'Object URLs',
  anchorDownload: 'File downloads',
  browserStorage: 'Local storage',
  webgl: 'WebGL 3D'
}

export default function FeatureTester() {
  const { notify } = useApp()
  const [report, setReport] = useState<Report | null>(null)
  const [running, setRunning] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const run = useCallback(async () => {
    setRunning(true)
    await new Promise<void>((resolve) => setTimeout(resolve, 40))
    try {
      const next = runFeatureTests() as Report
      setReport(next)
      setExpanded(new Set(next.results.filter((result) => result.status === 'fail').map((result) => result.id)))
      notify(
        next.summary.failed
          ? `${next.summary.failed} check(s) failed. See the report below.`
          : `All ${next.summary.total} feature checks passed.`,
        next.summary.failed ? 'warning' : 'success'
      )
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'The feature test runner failed.', 'error')
    } finally {
      setRunning(false)
    }
  }, [notify])

  useEffect(() => { void run() }, [run])

  const visible = useMemo(() => {
    if (!report) return []
    if (filter === 'all') return report.results
    return report.results.filter((result) => result.status === filter)
  }, [report, filter])

  const grouped = useMemo(() => FEATURE_TEST_GROUPS
    .map((group) => ({ group, results: visible.filter((result) => result.group === group) }))
    .filter((entry) => entry.results.length), [visible])

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const exportReport = () => {
    if (!report) return
    downloadJSON(report, `sciveyra-feature-report-${report.ranAt.slice(0, 10)}.json`)
    notify('Feature report downloaded.', 'success')
  }

  return <div>
    <PageHeader eyebrow="WORKSPACE / FEATURE TESTER" title="Built-in Feature Tester" description="Run local automated checks across datasets, every 2D and 3D graph type, analysis, exports, references and rewriting. Nothing is uploaded."
      actions={<>
        <Button variant="secondary" onClick={exportReport} disabled={!report} icon={<Download size={14} />}>Export report</Button>
        <Button variant="primary" onClick={() => void run()} disabled={running} icon={running ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}>{running ? 'Running…' : 'Re-run checks'}</Button>
      </>}
    />

    {report && <>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Checks</span>
            <FlaskConical size={15} className="text-blue-500" />
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-slate-900">{report.summary.total}</div>
          <div className="mt-2"><ProgressBar value={100} label="Runner complete" /></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Passed</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-emerald-600">{report.summary.passed}</div>
          <div className="mt-2"><ProgressBar value={report.summary.total ? (report.summary.passed / report.summary.total) * 100 : 0} label="Pass rate" /></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Failed</span>
            <XCircle size={15} className={report.summary.failed ? 'text-red-500' : 'text-slate-300'} />
          </div>
          <div className={`mt-1 font-display text-2xl font-extrabold ${report.summary.failed ? 'text-red-600' : 'text-slate-900'}`}>{report.summary.failed}</div>
          <div className="mt-2 text-[10px] text-slate-400">Run at {new Date(report.ranAt).toLocaleString()}</div>
        </Card>
      </div>

      {report.summary.failed === 0
        ? <div className="mb-3"><Callout tone="success"><b>All checks passed.</b> This confirms the built-in graph builders, analysis helpers, reference tools and local rewriter respond correctly in this browser. It is not a substitute for validating your scientific method.</Callout></div>
        : <div className="mb-3"><Callout tone="warning"><b>{report.summary.failed} check(s) failed.</b> Expand the failing rows below for the exact reason. Other tools remain usable.</Callout></div>}

      <Card className="mb-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><ShieldCheck size={15} className="text-emerald-500" /> Browser capabilities</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(report.environment).map(([key, available]) => <Badge key={key} tone={available ? 'green' : 'amber'}>
            {available ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            {CAPABILITY_LABELS[key] || key}: {available ? 'available' : 'unavailable'}
          </Badge>)}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">WebGL is required for interactive 3D scenes. PNG/PDF export uses Blob and object URLs; file download uses the browser's download attribute.</p>
      </Card>
    </>}

    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Check results</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Select a row to see the check detail and timing.</p>
        </div>
        <Tabs tabs={[{ id: 'all', label: `All ${report?.summary.total ?? ''}` }, { id: 'pass', label: 'Passed' }, { id: 'fail', label: 'Failed' }]} value={filter} onChange={(value) => setFilter(value as Filter)} />
      </div>

      {running && !report ? <div className="grid min-h-[250px] place-items-center text-[12px] font-semibold text-slate-500">Running local checks…</div>
        : !grouped.length ? <div className="grid min-h-[200px] place-items-center text-[12px] text-slate-400">No checks match this filter.</div>
          : <div className="space-y-4">
            {grouped.map(({ group, results }) => <section key={group}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group}</h3>
                <span className="text-[10px] font-semibold text-slate-400">{results.length}</span>
              </div>
              <div className="glass-subtle overflow-hidden rounded-xl border-slate-200/80">
                {results.map((result) => <div key={result.id} className="border-b border-slate-100 last:border-0">
                  <button type="button" onClick={() => toggle(result.id)} aria-expanded={expanded.has(result.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50/80">
                    {result.status === 'pass' ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> : <XCircle size={14} className="shrink-0 text-red-500" />}
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-700">{result.name}</span>
                    <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">{result.durationMs} ms</span>
                    <Badge tone={result.status === 'pass' ? 'green' : 'red'}>{result.status}</Badge>
                    <ChevronDown size={13} className={`text-slate-400 transition ${expanded.has(result.id) ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded.has(result.id) && <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[10.5px] leading-relaxed text-slate-600">{result.detail}</div>}
                </div>)}
              </div>
            </section>)}
          </div>}
    </Card>

    <div className="glass-subtle mt-3 flex flex-wrap items-center gap-2 rounded-2xl border-slate-200/70 px-4 py-3 text-[10.5px] text-slate-400">
      <ShieldCheck size={12} className="text-emerald-500" />
      Checks use the same local builders as the studio tools. They do not contact metadata providers or a hosted AI service.
    </div>
  </div>
}
