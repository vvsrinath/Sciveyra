import { Link } from 'react-router-dom'

type LogoProps = {
  large?: boolean
  to?: string
  /** Render the wordmark as white text (for use on coloured surfaces). */
  inverted?: boolean
}

export default function Logo({ large = false, to = '/', inverted = false }: LogoProps) {
  const markSize = large ? 'h-12 w-12 rounded-[15px]' : 'h-9 w-9 rounded-[11px]'
  const wordSize = large ? 'text-[27px]' : 'text-[19px]'

  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="SciVeyra home">
      <span className={`relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 text-white shadow-[0_6px_18px_-6px_rgba(37,99,235,.7)] ring-1 ring-inset ring-white/25 ${markSize}`}>
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,.55),transparent_55%)]" />
        <svg viewBox="0 0 32 32" className="relative h-[62%] w-[62%]" fill="none" aria-hidden="true">
          <path d="M21.6 9.4c-1.4-.9-3.2-1.4-5.1-1.4-2.9 0-4.8 1.3-4.8 3.2 0 1.7 1.4 2.6 4.4 3.4 3.7.9 5.9 2.3 5.9 5.2 0 3.4-2.9 5.6-7.2 5.6-2.3 0-4.4-.6-6-1.7" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24.6" cy="22.4" r="2.1" fill="#a5f3fc" />
        </svg>
      </span>
      <span className={`font-display font-extrabold leading-none tracking-[-0.045em] ${wordSize} ${inverted ? 'text-white' : 'text-slate-900'}`}>
        Sci<span className={inverted ? 'text-cyan-200' : 'text-blue-600'}>Veyra</span>
      </span>
    </Link>
  )
}
