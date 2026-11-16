export function uid(prefix = 'id') {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${random}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function formatDate(value) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function formatRelative(value) {
  if (!value) return 'Never'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return 'Unknown'
  const diff = Date.now() - then
  if (diff < 45_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`
  if (diff < 604_800_000) return `${Math.round(diff / 86_400_000)} d ago`
  return formatDate(value).split(',')[0]
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value) } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value))
}

export function debounce(fn, wait = 300) {
  let timer
  const wrapped = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
  wrapped.cancel = () => clearTimeout(timer)
  return wrapped
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function slugify(value, fallback = 'file') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

export function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${Number(count) || 0} ${(Number(count) || 0) === 1 ? singular : plural}`
}

export function formatBytes(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
