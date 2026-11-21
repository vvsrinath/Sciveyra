import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, Compass, ExternalLink, Github, HardDrive, Linkedin, Mail,
  ShieldCheck, Sparkles
} from 'lucide-react'
import { Badge, Card, PageHeader } from '../../components/ui'
import { CONTACT, DEVELOPER_NAME, copyrightLine } from '../../lib/siteMeta.js'

const links = [
  {
    label: 'LinkedIn',
    handle: 'srinath-v-a26b372b7',
    href: CONTACT.linkedin,
    icon: Linkedin,
    tint: 'from-blue-50 to-sky-50 text-blue-600 ring-blue-100'
  },
  {
    label: 'GitHub',
    handle: `@${CONTACT.githubUser}`,
    href: CONTACT.github,
    icon: Github,
    tint: 'from-slate-50 to-slate-100 text-slate-700 ring-slate-200'
  },
  {
    label: 'Email',
    handle: CONTACT.email,
    href: `mailto:${CONTACT.email}`,
    icon: Mail,
    tint: 'from-indigo-50 to-violet-50 text-indigo-600 ring-indigo-100'
  }
]

export default function Contact() {
  return <div className="space-y-5">
    <PageHeader
      eyebrow="Contact & credits"
      title="Meet the developer."
      description="SciVeyra is designed, built and maintained as a local-first, open research workspace. Reach out for feedback, collaboration or questions about the project."
      actions={<Link to="/home" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-4 text-[12px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
        Open workspace <ArrowRight size={14} />
      </Link>}
    />

    <div className="grid gap-4 lg:grid-cols-[minmax(280px,.85fr)_minmax(0,1.15fr)]">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-blue-200/50 to-cyan-100/40 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute -inset-2 rounded-[32px] bg-gradient-to-br from-blue-300/40 via-indigo-200/40 to-cyan-200/50 blur-xl" />
            <img
              src="/developer-srinath.png"
              alt={`Portrait of ${DEVELOPER_NAME}`}
              width={250}
              height={250}
              className="relative h-44 w-44 rounded-[28px] border-4 border-white/90 object-cover shadow-[0_24px_60px_-24px_rgba(37,99,235,.55)] ring-1 ring-slate-200/80"
            />
            <span className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lift">
              <BadgeCheck size={19} />
            </span>
          </div>

          <h2 className="mt-5 font-display text-[21px] font-extrabold tracking-[-0.03em] text-slate-900">{DEVELOPER_NAME}</h2>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.14em] text-blue-600">Creator & developer · SciVeyra</p>
          <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-slate-500">Building calm, privacy-respecting tools that help students and researchers move from question to evidence to publication.</p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <Badge tone="green"><ShieldCheck size={11} /> Local-first</Badge>
            <Badge tone="blue"><Sparkles size={11} /> Open source</Badge>
            <Badge tone="slate"><HardDrive size={11} /> No account</Badge>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900">Get in touch</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Links open the real profiles. No form, no tracking, no intermediary.</p>
            </div>
            <Badge tone="green">Public</Badge>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {links.map((link) => <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lift"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ${link.tint}`}><link.icon size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{link.label}</span>
                <span className="mt-0.5 block truncate text-[12.5px] font-bold text-slate-700">{link.handle}</span>
              </span>
              <ExternalLink size={14} className="shrink-0 text-slate-300 group-hover:text-blue-500" />
            </a>)}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Compass size={16} /></span><h2 className="font-display text-[16px] font-extrabold tracking-tight text-slate-900">About this project</h2></div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">SciVeyra is a static, browser-based research workspace: plotting, 3D visualisation, image and figure tools, reference discovery, citation management, drafting and honest integrity checks. Your work stays in this browser unless you export it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/toolkit" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-3.5 text-[11.5px] font-bold text-white shadow-[0_10px_22px_-10px_rgba(37,99,235,.7)] transition hover:brightness-105">
              Explore the toolkit <ArrowRight size={13} />
            </Link>
            <a href={`${CONTACT.github}/Sciveyra`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-[11.5px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-700">
              <Github size={13} /> Source repository
            </a>
          </div>
        </Card>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 text-[11px] leading-relaxed text-slate-400 backdrop-blur">
          <p className="font-bold text-slate-500">{copyrightLine()}</p>
          <p className="mt-1">All rights reserved. SciVeyra is local-first, free to use and has no paid AI API calls.</p>
        </div>
      </div>
    </div>
  </div>
}
