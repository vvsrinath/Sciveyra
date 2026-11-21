/**
 * Honest map of the research tools people ask about.
 *
 * `kind: 'native'` cards open a working SciVeyra route. `kind: 'external'`
 * cards open the provider's own website; they are never presented as if
 * SciVeyra implements or licenses them.
 */

export const TOOL_CATEGORIES = [
  { id: 'discovery', label: 'Discovery & mapping', description: 'Find papers and see how studies connect.' },
  { id: 'references', label: 'Reference & citation management', description: 'Organise records, PDFs metadata and bibliographies.' },
  { id: 'notes', label: 'Notes & knowledge organisation', description: 'Turn reading into linked, reusable notes.' },
  { id: 'collection', label: 'Data collection & surveys', description: 'Gather responses or structured web data.' },
  { id: 'analysis', label: 'Statistics & analysis', description: 'Clean, analyse, visualise and code your data.' },
  { id: 'writing', label: 'Academic writing & formatting', description: 'Draft, structure and polish the manuscript.' },
  { id: 'integrity', label: 'Plagiarism & integrity', description: 'Check claims and presentation before submission.' }
]

export const ACCESS_LABELS = {
  'open-source': 'Open source',
  free: 'Free tier',
  institutional: 'Institutional / paid',
  proprietary: 'Proprietary'
}

export const ACCESS_FILTERS = [
  { id: 'all', label: 'All access' },
  { id: 'open-source', label: 'Open source' },
  { id: 'free', label: 'Free tier' },
  { id: 'institutional', label: 'Institutional / paid' },
  { id: 'proprietary', label: 'Proprietary' }
]

export const TOOLS = [
  // 1. Discovery and mapping -------------------------------------------------
  {
    id: 'sciv-graph-map',
    name: 'SciVeyra Diagram Studio',
    category: 'discovery',
    kind: 'native',
    to: '/diagrams',
    access: 'open-source',
    nativeFor: 'Visual paper maps / concept maps',
    detail: 'Draw concept maps and study-flow diagrams locally, then export PNG, SVG or PDF.'
  },
  {
    id: 'connected-papers',
    name: 'Connected Papers',
    category: 'discovery',
    kind: 'external',
    url: 'https://www.connectedpapers.com/',
    access: 'free',
    detail: 'External visual literature map. Free tier and terms are set by the provider.'
  },
  {
    id: 'researchrabbit',
    name: 'ResearchRabbit',
    category: 'discovery',
    kind: 'external',
    url: 'https://www.researchrabbit.ai/',
    access: 'free',
    detail: 'External literature-discovery network. SciVeyra links out; it does not proxy results.'
  },
  {
    id: 'scopus',
    name: 'Scopus',
    category: 'discovery',
    kind: 'external',
    url: 'https://www.scopus.com/',
    access: 'institutional',
    detail: 'Large proprietary abstract database; usually needs an institutional subscription.'
  },
  {
    id: 'web-of-science',
    name: 'Web of Science',
    category: 'discovery',
    kind: 'external',
    url: 'https://www.webofscience.com/',
    access: 'institutional',
    detail: 'Proprietary citation index; access depends on your institution.'
  },
  {
    id: 'ieee-xplore',
    name: 'IEEE Xplore',
    category: 'discovery',
    kind: 'external',
    url: 'https://ieeexplore.ieee.org/',
    access: 'institutional',
    detail: 'Publisher platform for electrical engineering, computing and related fields.'
  },
  {
    id: 'pubmed',
    name: 'PubMed',
    category: 'discovery',
    kind: 'external',
    url: 'https://pubmed.ncbi.nlm.nih.gov/',
    access: 'free',
    detail: 'Free biomedical literature database from the US National Library of Medicine.'
  },
  {
    id: 'sciv-reference-finder',
    name: 'SciVeyra Reference Finder',
    category: 'discovery',
    kind: 'native',
    to: '/navigator',
    access: 'open-source',
    nativeFor: 'PubMed / free metadata search',
    detail: 'Searches OpenAlex, DOAJ, Europe PMC, Crossref and arXiv. Provider errors are shown, never invented.'
  },

  // 2. Reference and citation management ------------------------------------
  {
    id: 'sciv-reference-manager',
    name: 'SciVeyra Reference Manager',
    category: 'references',
    kind: 'native',
    to: '/references',
    access: 'open-source',
    nativeFor: 'Zotero-style local library',
    detail: 'Add, deduplicate, import/export BibTeX and RIS, format citations and resolve DOI metadata.'
  },
  {
    id: 'zotero',
    name: 'Zotero',
    category: 'references',
    kind: 'external',
    url: 'https://www.zotero.org/',
    access: 'open-source',
    detail: 'Free open-source reference manager with a popular browser connector.'
  },
  {
    id: 'mendeley',
    name: 'Mendeley',
    category: 'references',
    kind: 'external',
    url: 'https://www.mendeley.com/',
    access: 'free',
    detail: 'Elsevier reference manager; free tier and collaboration limits apply.'
  },
  {
    id: 'endnote',
    name: 'EndNote',
    category: 'references',
    kind: 'external',
    url: 'https://endnote.com/',
    access: 'institutional',
    detail: 'Proprietary citation manager often supplied by universities.'
  },

  // 3. Notes and knowledge organisation -------------------------------------
  {
    id: 'sciv-writing-lab-notes',
    name: 'SciVeyra Writing Lab notes',
    category: 'notes',
    kind: 'native',
    to: '/writing',
    access: 'open-source',
    nativeFor: 'Obsidian-style linked Markdown notes',
    detail: 'Local Markdown drafts, outline templates and a claim–evidence map linked to your references.'
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'notes',
    kind: 'external',
    url: 'https://www.notion.so/',
    access: 'free',
    detail: 'Cloud workspace for databases and notes; free plan has feature and storage limits.'
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'notes',
    kind: 'external',
    url: 'https://obsidian.md/',
    access: 'free',
    detail: 'Local Markdown wiki with backlinks. Free for personal use; the app itself is not open source.'
  },
  {
    id: 'onenote',
    name: 'Microsoft OneNote',
    category: 'notes',
    kind: 'external',
    url: 'https://www.onenote.com/',
    access: 'free',
    detail: 'Freeform cloud notebook with web clipping; account and service terms apply.'
  },

  // 4. Data collection and surveys ------------------------------------------
  {
    id: 'sciv-csv-import',
    name: 'SciVeyra CSV / Excel import',
    category: 'collection',
    kind: 'native',
    to: '/graphs',
    access: 'open-source',
    nativeFor: 'Survey response table import',
    detail: 'Paste or import CSV/TSV/Excel response tables and clean them in the local data editor.'
  },
  {
    id: 'google-forms',
    name: 'Google Forms',
    category: 'collection',
    kind: 'external',
    url: 'https://forms.google.com/',
    access: 'free',
    detail: 'Simple online questionnaires; responses are held by Google.'
  },
  {
    id: 'microsoft-forms',
    name: 'Microsoft Forms',
    category: 'collection',
    kind: 'external',
    url: 'https://forms.office.com/',
    access: 'free',
    detail: 'Simple online questionnaires for Microsoft accounts.'
  },
  {
    id: 'qualtrics',
    name: 'Qualtrics',
    category: 'collection',
    kind: 'external',
    url: 'https://www.qualtrics.com/',
    access: 'institutional',
    detail: 'Advanced proprietary survey platform; licensing is institution-led.'
  },
  {
    id: 'surveymonkey',
    name: 'SurveyMonkey',
    category: 'collection',
    kind: 'external',
    url: 'https://www.surveymonkey.com/',
    access: 'free',
    detail: 'Survey platform with a limited free tier and paid response limits.'
  },
  {
    id: 'beautifulsoup',
    name: 'BeautifulSoup',
    category: 'collection',
    kind: 'external',
    url: 'https://www.crummy.com/software/BeautifulSoup/',
    access: 'open-source',
    detail: 'Open-source Python library for parsing HTML/XML. Run it in your own environment.'
  },
  {
    id: 'scrapy',
    name: 'Scrapy',
    category: 'collection',
    kind: 'external',
    url: 'https://scrapy.org/',
    access: 'open-source',
    detail: 'Open-source Python crawling framework. Respect site terms, robots.txt and privacy law.'
  },

  // 5. Statistics and analysis ----------------------------------------------
  {
    id: 'sciv-graph-studio',
    name: 'SciVeyra Graph Studio',
    category: 'analysis',
    kind: 'native',
    to: '/graphs',
    access: 'open-source',
    nativeFor: 'Excel / R / Python-style basic analysis',
    detail: 'Descriptive statistics, correlation, regression, curve fitting, outlier flags and publication exports.'
  },
  {
    id: 'sciv-qual-coder',
    name: 'SciVeyra Qualitative Coder',
    category: 'analysis',
    kind: 'native',
    to: '/toolkit?tab=coder',
    access: 'open-source',
    nativeFor: 'NVivo-style keyword coding',
    detail: 'A local session tool for literal code counts, context snippets and CSV export. Not an AI theme analyser.'
  },
  {
    id: 'excel',
    name: 'Microsoft Excel',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.microsoft.com/en-us/microsoft-365/excel',
    access: 'proprietary',
    detail: 'Proprietary spreadsheet; SciVeyra can import its CSV/TSV exports but does not implement Excel.'
  },
  {
    id: 'spss',
    name: 'SPSS',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.ibm.com/products/spss-statistics',
    access: 'institutional',
    detail: 'Proprietary point-and-click statistics package, commonly licensed by institutions.'
  },
  {
    id: 'stata',
    name: 'Stata',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.stata.com/',
    access: 'institutional',
    detail: 'Proprietary statistics and data-management software.'
  },
  {
    id: 'sas',
    name: 'SAS',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.sas.com/en_us/software/stat.html',
    access: 'institutional',
    detail: 'Proprietary analytics suite with institutional and commercial licensing.'
  },
  {
    id: 'r-project',
    name: 'R + RStudio / Posit',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.r-project.org/',
    access: 'open-source',
    detail: 'Open-source statistical computing. RStudio/Posit offers a free open-source IDE build.'
  },
  {
    id: 'python-stack',
    name: 'Python data stack',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.python.org/',
    access: 'open-source',
    nativeFor: 'Pandas · NumPy · SciPy · Matplotlib',
    detail: 'Open-source Python ecosystem for analysis, simulation and publication-grade plots.'
  },
  {
    id: 'nvivo',
    name: 'NVivo',
    category: 'analysis',
    kind: 'external',
    url: 'https://www.qsrinternational.com/nvivo-qualitative-data-analysis-software/home',
    access: 'institutional',
    detail: 'Proprietary qualitative analysis software; institutional licences are typical.'
  },
  {
    id: 'atlas-ti',
    name: 'ATLAS.ti',
    category: 'analysis',
    kind: 'external',
    url: 'https://atlasti.com/',
    access: 'proprietary',
    detail: 'Proprietary qualitative data analysis platform with paid plans.'
  },

  // 6. Academic writing and formatting --------------------------------------
  {
    id: 'sciv-writing-lab',
    name: 'SciVeyra Writing Lab',
    category: 'writing',
    kind: 'native',
    to: '/writing',
    access: 'open-source',
    nativeFor: 'Local Markdown / LaTeX-friendly drafting',
    detail: 'Templates, section guidance, word targets, claim linking, citation insertion and TXT/MD export.'
  },
  {
    id: 'overleaf',
    name: 'Overleaf (LaTeX)',
    category: 'writing',
    kind: 'external',
    url: 'https://www.overleaf.com/',
    access: 'free',
    detail: 'Collaborative LaTeX with a free tier; open-source edition can be self-hosted.'
  },
  {
    id: 'word',
    name: 'Microsoft Word',
    category: 'writing',
    kind: 'external',
    url: 'https://www.microsoft.com/en-us/microsoft-365/word',
    access: 'proprietary',
    detail: 'Standard proprietary word processor with Zotero/Mendeley add-ins.'
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    category: 'writing',
    kind: 'external',
    url: 'https://docs.google.com/',
    access: 'free',
    detail: 'Free cloud word processor; your document is stored by Google.'
  },
  {
    id: 'sciv-rewriter',
    name: 'SciVeyra Paragraph Rewriter',
    category: 'writing',
    kind: 'native',
    to: '/rewriter',
    access: 'open-source',
    nativeFor: 'Grammarly / QuillBot-style local polish',
    detail: 'Deterministic local rewriting with protected numbers, units, DOIs and citations; optional self-hosted Ollama.'
  },
  {
    id: 'grammarly',
    name: 'Grammarly',
    category: 'writing',
    kind: 'external',
    url: 'https://www.grammarly.com/',
    access: 'free',
    detail: 'Cloud grammar assistant with a limited free tier; paid plans add features.'
  },
  {
    id: 'quillbot',
    name: 'QuillBot',
    category: 'writing',
    kind: 'external',
    url: 'https://quillbot.com/',
    access: 'free',
    detail: 'Cloud paraphrasing tool with free limits; review all suggestions for accuracy.'
  },

  // 7. Integrity -------------------------------------------------------------
  {
    id: 'sciv-writing-checks',
    name: 'SciVeyra writing checks',
    category: 'integrity',
    kind: 'native',
    to: '/writing',
    access: 'open-source',
    nativeFor: 'Local consistency and claim checks',
    detail: 'Rule-based checks plus a claim–evidence map. These are heuristics, not an AI detector or plagiarism database.'
  },
  {
    id: 'turnitin',
    name: 'Turnitin',
    category: 'integrity',
    kind: 'external',
    url: 'https://www.turnitin.com/',
    access: 'institutional',
    detail: 'Institution-provided similarity service; SciVeyra has no connection to its database.'
  },
  {
    id: 'ithenticate',
    name: 'iThenticate',
    category: 'integrity',
    kind: 'external',
    url: 'https://www.ithenticate.com/',
    access: 'institutional',
    detail: 'Publisher-oriented similarity service with paid/institutional access.'
  }
]

const CATEGORY_IDS = new Set(TOOL_CATEGORIES.map((category) => category.id))
const ACCESS_IDS = new Set(Object.keys(ACCESS_LABELS))

export function isValidTool(tool) {
  return !!tool && !!tool.id && !!tool.name && !!tool.detail
    && CATEGORY_IDS.has(tool.category)
    && ACCESS_IDS.has(tool.access)
    && (tool.kind === 'native' ? String(tool.to || '').startsWith('/') : /^https:\/\//.test(String(tool.url || '')))
}

export function toolsForCategory(categoryId) {
  return TOOLS.filter((tool) => tool.category === categoryId)
}

export function filterTools({ query = '', category = 'all', access = 'all' } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase()
  return TOOLS.filter((tool) => {
    if (category !== 'all' && tool.category !== category) return false
    if (access !== 'all' && tool.access !== access) return false
    if (!needle) return true
    const haystack = [tool.name, tool.detail, tool.nativeFor, ACCESS_LABELS[tool.access]].filter(Boolean).join(' ').toLocaleLowerCase()
    return haystack.includes(needle)
  })
}

export function countByAccess(tools = TOOLS) {
  return tools.reduce((counts, tool) => {
    counts[tool.access] = (counts[tool.access] || 0) + 1
    return counts
  }, {})
}

export function categoryLabel(categoryId) {
  return TOOL_CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId
}
