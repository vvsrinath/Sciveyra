import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, ClipboardList, Compass, Download,
  ExternalLink, FileText, Filter, FlaskConical, Layers, LineChart, Mail, Network, PenLine,
  Search, ShieldCheck, Sparkles, WandSparkles
} from 'lucide-react'
import { Badge, Button, Callout, Card, Field, PageHeader, Select, Tabs } from '../../components/ui'
import { useApp } from '../../app/AppContext'
import {
  ACCESS_FILTERS,
  ACCESS_LABELS,
  TOOL_CATEGORIES,
  categoryLabel,
  filterTools,
  toolsForCategory
} from '../../lib/toolDirectory.js'
import { buildCodebook, codebookCsv } from '../../lib/qualCoding.js'

type ToolTab = 'workflow' | 'directory' | 'coder'
type Access = 'open-source' | 'free' | 'institutional' | 'proprietary'
type DirectoryTool = {
  id: string
  name: string
  category: string
  kind: 'native' | 'external'
  to?: string
  url?: string
  access: Access
  nativeFor?: string
  detail: string
}

const typedToolsForCategory = (id: string): DirectoryTool[] => toolsForCategory(id) as DirectoryTool[]

const categoryIcons: Record<string, typeof Compass> = {
  discovery: Search,
  references: BookOpen,
  notes: PenLine,
  collection: ClipboardList,
  analysis: BarChart3,
  writing: FileText,
  integrity: ShieldCheck
}

const accessTone: Record<Access, 'green' | 'blue' | 'amber' | 'slate'> = {
  'open-source': 'green',
  free: 'blue',
  institutional: 'amber',
  proprietary: 'slate'
}

const workflow = [
  {
    step: '01', title: 'Discover', icon: Search, to: '/navigator',
    detail: 'Search free scholarly metadata and save the records you trust.',
    badge: 'Reference Finder'
  },
  {
    step: '02', title: 'Organise', icon: BookOpen, to: '/references',
    detail: 'Keep a deduplicated BibTeX/RIS library with citation formatting.',
    badge: 'Reference Manager'
  },
  {
    step: '03', title: 'Analyse', icon: LineChart, to: '/graphs',
    detail: 'Clean CSV/Excel tables, run statistics and export figures.',
    badge: 'Graph Studio'
  },
  {
    step: '04', title: 'Write', icon: PenLine, to: '/writing',
    detail: 'Draft in Markdown, follow an outline and link claims to sources.',
    badge: 'Writing Lab'
  },
  {
    step: '05', title: 'Check', icon: ShieldCheck, to: '/rewriter',
    detail: 'Polish locally and review honest, rule-based integrity checks.',
    badge: 'Rewriter + checks'
  }
]

const SAMPLE_TRANSCRIPT = `Synthetic example — not research data:
P1: "At first I did not trust the tool, but clear consent explanations helped."
P2: "Transparency matters more than speed. Access was a barrier for our team."`

function ToolCard({ tool }: { tool: DirectoryTool }) {
  const isNative = tool.kind === 'native'
  const Icon = isNative ? Compass : ExternalLink
  const inner = <>
    <div className="flex items-start justify-between gap-2">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${isNative ? 'bg-blue-50 text-blue-600 ring-blue-100' : 'bg-slate-50 text-slate-500 ring-slate-200'}`}>
        <Icon size={18} />
      </span>
      <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-blue-500" />
    </div>
    <h3 className="mt-3 text-[13.5px] font-extrabold tracking-tight text-slate-900">{tool.name}</h3>
    {tool.nativeFor && <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-blue-600">{tool.nativeFor}</p>}
    <p className="mt-1.5 flex-1 text-[11.5px] leading-relaxed text-slate-500">{tool.detail}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <Badge tone={isNative ? 'green' : 'slate'}>{isNative ? 'Works in app' : 'External site'}</Badge>
      <Badge tone={accessTone[tool.access]}>{ACCESS_LABELS[tool.access]}</Badge>
    </div>
    <span className="mt-2 block text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{categoryLabel(tool.category)}</span>
  </>

  const className = 'group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-soft backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lift'
  return isNative
    ? <Link to={tool.to || '/toolkit'} className={className}>{inner}</Link>
    : <a href={tool.url} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
}

export default function ResearchToolkit() {
  const { notify } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: ToolTab = tabParam === 'directory' || tabParam === 'coder' ? tabParam : 'workflow'

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [access, setAccess] = useState('all')
  const [transcript, setTranscript] = useState('')
  const [codes, setCodes] = useState('trust, transparency, barrier')

  const results = useMemo(() => filterTools({ query, category, access }) as DirectoryTool[], [query, category, access])
  const codebook = useMemo(() => buildCodebook(transcript, codes), [transcript, codes])
  const codedRows = codebook.filter((row) => row.count > 0)

  const setTab = (next: ToolTab) => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  const exportCodebook = () => {
    const blob = new Blob([codebookCsv(codebook)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sciveyra-codebook.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    notify('Codebook exported as CSV.', 'success')
  }

  return <div className="space-y-5">
    <PageHeader
      eyebrow="Research toolkit"
      title="Every research step, one honest map."
      description="Find the local equivalent first, then use the external directory when a specialist service is genuinely needed. Native cards open working tools; external cards open the provider’s own site with its licence clearly labelled."
      actions={<>
        <Button icon={<Compass size={15} />} onClick={() => setTab('directory')}>Browse directory</Button>
        <Link to="/contact" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
          <Mail size={14} /> Contact developer
        </Link>
      </>}
    />

    <Callout tone="info">
      <b>Free/open-source first.</b> SciVeyra does not pretend to implement Scopus, Turnitin, SPSS or any other proprietary service. Where a local equivalent exists, it is built in; otherwise the tool is listed as an external reference and you use it under its own terms.
    </Callout>

    <Tabs
      tabs={[
        { id: 'workflow', label: 'Local workflow' },
        { id: 'directory', label: 'Tool directory' },
        { id: 'coder', label: 'Qualitative coder' }
      ]}
      value={tab}
      onChange={setTab}
    />

    {tab === 'workflow' && <div className="space-y-5">
      <Card className="overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">The whole SciVeyra idea</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">One browser, one local library, five connected moves. Nothing is uploaded to run the workflow, and every export stays in your hands.</p>
          </div>
          <Badge tone="green"><ShieldCheck size={12} /> Local-first</Badge>
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          {workflow.map((item, index) => <div key={item.step} className="relative flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white/90 to-blue-50/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-600 shadow-soft ring-1 ring-inset ring-blue-100"><item.icon size={17} /></span>
              <span className="font-display text-[11px] font-extrabold tracking-[0.14em] text-slate-300">{item.step}</span>
            </div>
            <h3 className="mt-3 text-[13px] font-extrabold text-slate-800">{item.title}</h3>
            <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
            <Link to={item.to} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline">
              {item.badge} <ArrowRight size={12} />
            </Link>
            {index < workflow.length - 1 && <ArrowRight size={13} className="absolute -right-2 top-1/2 hidden text-slate-300 xl:block" />}
          </div>)}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {TOOL_CATEGORIES.map((item) => {
          const Icon = categoryIcons[item.id] || Compass
          const native = typedToolsForCategory(item.id).filter((tool) => tool.kind === 'native')
          const externalCount = typedToolsForCategory(item.id).length - native.length
          return <Card key={item.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100"><Icon size={18} /></span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-extrabold tracking-tight text-slate-900">{item.label}</h3>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{item.description}</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-50 px-2 py-1 text-[9.5px] font-bold text-slate-400">{externalCount} external</span>
            </div>
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {native.map((tool) => <Link key={tool.id} to={tool.to || '/toolkit'} className="group flex items-center gap-2 rounded-xl border border-slate-100 bg-white/70 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/40">
                <Check size={13} className="shrink-0 text-emerald-500" />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-700">{tool.name}</span>
                <ArrowRight size={12} className="shrink-0 text-slate-300 group-hover:text-blue-500" />
              </Link>)}
            </div>
          </Card>
        })}
      </div>
    </div>}

    {tab === 'directory' && <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px]">
          <Field label="Search tools" htmlFor="tool-query">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="tool-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try Zotero, LaTeX, survey, plagiarism…"
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-white/85 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </Field>
          <Field label="Category" htmlFor="tool-category">
            <Select id="tool-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {TOOL_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Access" htmlFor="tool-access">
            <Select id="tool-access" value={access} onChange={(event) => setAccess(event.target.value)}>
              {ACCESS_FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Filter size={12} /> {results.length} matching tools</span>
          <button type="button" onClick={() => { setQuery(''); setCategory('all'); setAccess('all') }} className="font-bold text-blue-600 hover:underline">Clear filters</button>
        </div>
      </Card>

      {results.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {results.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
      </div> : <Card className="p-10 text-center">
        <Compass size={28} className="mx-auto text-slate-300" />
        <h3 className="mt-3 text-[14px] font-extrabold text-slate-700">No tools match those filters.</h3>
        <p className="mt-1 text-[12px] text-slate-500">Try a broader term or clear the filters.</p>
      </Card>}

      <p className="px-1 text-[10.5px] leading-relaxed text-slate-400">External links open third-party websites. Free tiers, subscriptions, data handling and availability are controlled by each provider; SciVeyra receives no commission and claims no integration.</p>
    </div>}

    {tab === 'coder' && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">Local qualitative coder</h2>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-slate-500">A lightweight, literal alternative for first-pass interview coding. Paste text, list your codes and export the counts as CSV.</p>
          </div>
          <Badge tone="blue"><Sparkles size={12} /> No AI · no upload</Badge>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Transcript or field notes" htmlFor="qual-text" hint="This stays in this page only. It is not written to IndexedDB or included in backups.">
            <textarea
              id="qual-text"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={9}
              placeholder="Paste interview excerpts, open responses or field notes here…"
              className="w-full resize-y rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
          </Field>

          <Field label="Codes" htmlFor="qual-codes" hint="Separate codes with commas, semicolons or new lines. Matching is literal and case-insensitive.">
            <textarea
              id="qual-codes"
              value={codes}
              onChange={(event) => setCodes(event.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2.5 text-[12.5px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download size={15} />} onClick={exportCodebook} disabled={!codebook.length}>Export CSV</Button>
            <Button icon={<FlaskConical size={15} />} onClick={() => { setTranscript(SAMPLE_TRANSCRIPT); setCodes('trust, transparency, barrier') }}>Load synthetic example</Button>
            <Button variant="ghost" onClick={() => { setTranscript(''); setCodes('') }}>Clear</Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-extrabold tracking-tight text-slate-900">Codebook results</h3>
            <Badge tone={codedRows.length ? 'green' : 'slate'}>{codedRows.length} with matches</Badge>
          </div>
          {codebook.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[440px] text-left text-[11.5px]">
              <thead className="bg-slate-50/80 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <tr><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Count</th><th className="px-3 py-2.5">First context</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codebook.map((row) => <tr key={row.code} className={row.count ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5 font-bold text-slate-700">{row.code}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 font-extrabold ${row.count ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>{row.count}</span></td>
                  <td className="max-w-[240px] px-3 py-2.5 text-slate-500">{row.context || 'No match'}</td>
                </tr>)}
              </tbody>
            </table>
          </div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <ClipboardList size={26} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[12px] font-bold text-slate-600">Add codes to see their counts.</p>
          </div>}
        </Card>

        <Card className="border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-5">
          <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600"><ShieldCheck size={14} /></span><h3 className="text-[13.5px] font-extrabold text-slate-900">Honest limits</h3></div>
          <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-slate-500">
            <li>• Counts literal words or phrases; they do not infer themes or sentiment.</li>
            <li>• Session-only by design: export the CSV before you leave or refresh.</li>
            <li>• For commercial qualitative analysis, use an external tool from the directory under its own licence.</li>
          </ul>
          <Link to="/toolkit?tab=directory" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline">See qualitative tools <ArrowRight size={12} /></Link>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/graphs" className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"><LineChart size={15} className="text-blue-500" /> Graph Studio</Link>
          <Link to="/writing" className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"><PenLine size={15} className="text-violet-500" /> Writing Lab</Link>
          <Link to="/diagrams" className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"><Network size={15} className="text-cyan-500" /> Diagram Studio</Link>
          <Link to="/rewriter" className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"><WandSparkles size={15} className="text-purple-500" /> Rewriter</Link>
        </div>
      </div>
    </div>}
  </div>
}
