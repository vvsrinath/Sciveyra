import { Component, forwardRef, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, X, XCircle } from 'lucide-react'
import { useApp } from '../app/AppContext'

export const inputClass = 'h-10 w-full rounded-xl border border-slate-200/90 bg-white/80 px-3 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,.03)] outline-none backdrop-blur-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', className = '', icon, children, ...props }: ButtonProps) {
  const variants = {
    primary: 'border-transparent bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.6)] hover:shadow-[0_12px_26px_-8px_rgba(37,99,235,.7)] hover:brightness-[1.04]',
    secondary: 'glass-chip border-slate-200/90 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-slate-900',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  }
  const sizes = { sm: 'h-8 rounded-lg px-3 text-[11.5px]', md: 'h-10 rounded-xl px-4 text-[12.5px]' }
  return <button
    className={`inline-flex shrink-0 items-center justify-center gap-1.5 border font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  >{icon}{children}</button>
}

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button
    type="button"
    aria-label={label}
    title={label}
    className={`glass-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 ${className}`}
    {...props}
  >{children}</button>
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={`glass-panel rounded-2xl ${className}`} {...props}>{children}</section>
}

export function Field({ label, htmlFor, hint, children, required, className = '' }: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return <div className={className}>
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between gap-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
      <span>{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>
    </label>
    {children}
    {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">{hint}</p>}
  </div>
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  const { className = '', ...rest } = props
  return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />
})

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} ${className}`} {...props}>{children}</select>
}

export function Toggle({ checked, onChange, label, hint, disabled }: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  return <div className="flex items-start justify-between gap-3 py-1.5">
    <div className="min-w-0">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700">{label}</label>
      {hint && <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">{hint}</p>}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50 ${checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-slate-200'}`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? 'left-[17px]' : 'left-[3px]'}`} />
    </button>
  </div>
}

export function Badge({ children, tone = 'blue', className = '' }: { children: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate'; className?: string }) {
  const tones = {
    blue: 'border-blue-200/80 bg-blue-50 text-blue-700',
    green: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200/80 bg-amber-50 text-amber-700',
    red: 'border-red-200/80 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600'
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.02em] ${tones[tone]} ${className}`}>{children}</span>
}

export function Spinner({ label = 'Working…' }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-500" role="status"><Loader2 size={16} className="animate-spin text-blue-500" />{label}</span>
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 ring-1 ring-inset ring-blue-100">{icon}</div>}
    <h3 className="text-[15px] font-extrabold tracking-tight text-slate-800">{title}</h3>
    <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-slate-500">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
}

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>('input,select,textarea,button')
      first?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[3px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`glass-panel max-h-[90vh] w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} overflow-auto rounded-3xl shadow-[0_40px_100px_-30px_rgba(15,23,42,.4)]`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}><X size={16} /></IconButton>
      </div>
      <div className="p-6">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">{footer}</div>}
    </div>
  </div>
}

export function Collapsible({ title, children, defaultOpen = true, icon }: { title: string; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return <div className="border-b border-slate-100 py-2 last:border-0">
    <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 py-1.5 text-left text-[11.5px] font-bold text-slate-600 transition hover:text-slate-900" aria-expanded={open}>
      {icon}<span className="flex-1">{title}</span><ChevronDown size={14} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="pb-2 pt-1">{children}</div>}
  </div>
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400" />
        {eyebrow}
      </div>
      <h1 className="mt-1.5 font-display text-[27px] font-extrabold leading-tight tracking-[-0.035em] text-slate-900 sm:text-[31px]">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
}

export function ToastStack() {
  const { toasts, dismissToast } = useApp()
  const icons = {
    success: <CheckCircle2 size={17} className="text-emerald-500" />,
    error: <XCircle size={17} className="text-red-500" />,
    warning: <AlertTriangle size={17} className="text-amber-500" />,
    info: <Info size={17} className="text-blue-500" />
  }
  const accents = {
    success: 'before:bg-emerald-400',
    error: 'before:bg-red-400',
    warning: 'before:bg-amber-400',
    info: 'before:bg-blue-400'
  }
  return <div aria-live="polite" aria-atomic="false" className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,400px)] flex-col gap-2">
    {toasts.map((toast) => <div key={toast.id} className={`relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-3.5 pl-4 shadow-[0_24px_60px_-20px_rgba(15,23,42,.35)] backdrop-blur before:absolute before:inset-y-0 before:left-0 before:w-1 ${accents[toast.tone]}`}>
      <span className="mt-0.5">{icons[toast.tone]}</span>
      <p className="flex-1 text-[12px] leading-relaxed text-slate-700">{toast.message}</p>
      <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification" className="mt-0.5 text-slate-400 transition hover:text-slate-700"><X size={14} /></button>
    </div>)}
  </div>
}

export function Callout({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' | 'error' }) {
  const tones = {
    info: 'border-blue-200/80 bg-blue-50/70 text-blue-800',
    warning: 'border-amber-200/80 bg-amber-50/70 text-amber-800',
    success: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800',
    error: 'border-red-200/80 bg-red-50/70 text-red-800'
  }
  const icons = {
    info: <Info size={15} />, warning: <AlertTriangle size={15} />, success: <CheckCircle2 size={15} />, error: <XCircle size={15} />
  }
  return <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-[11.5px] leading-relaxed ${tones[tone]}`}>
    <span className="mt-0.5 shrink-0">{icons[tone]}</span>
    <div className="min-w-0">{children}</div>
  </div>
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return <div>
    {label && <div className="mb-1.5 flex justify-between text-[10.5px] font-medium text-slate-500"><span>{label}</span><span>{Math.round(value)}%</span></div>}
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  </div>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div role="tablist" className="glass-subtle flex gap-1 overflow-x-auto rounded-xl border-slate-200/70 bg-slate-100/60 p-1">
    {tabs.map((tab) => <button
      key={tab.id}
      role="tab"
      aria-selected={value === tab.id}
      type="button"
      onClick={() => onChange(tab.id)}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition sm:flex-1 sm:min-w-0 ${value === tab.id ? 'bg-white/95 text-blue-700 shadow-[0_1px_3px_rgba(15,23,42,.12)]' : 'text-slate-500 hover:text-slate-700'}`}
    >{tab.label}</button>)}
  </div>
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('SciVeyra tool error', error) }
  render() {
    if (this.state.error) {
      return <div className="m-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-card">
        <h2 className="text-sm font-extrabold">This tool encountered an error</h2>
        <p className="mt-1 text-xs leading-relaxed">Your saved data is not affected. Reload the page or try another tool.</p>
        <pre className="mt-3 overflow-auto rounded-xl border border-red-100 bg-white/80 p-3 text-[10.5px] text-red-700">{this.state.error.message}</pre>
        <Button className="mt-3" variant="secondary" onClick={() => this.setState({ error: null })}>Try again</Button>
      </div>
    }
    return this.props.children
  }
}
