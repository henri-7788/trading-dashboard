import Link from 'next/link'
import { BrandMark, GearIcon } from './ui'
import { fmtDate } from '../lib/tradeStats'

/**
 * Closing band at the foot of the dashboard — the hero band's material mirrored, so the page is framed
 * in petrol top and bottom instead of trailing off into grey. Carries sync state, sources, and a way back up.
 */
export default function PageFooter({
  lastSyncedAt,
  sources,
  loading
}: {
  lastSyncedAt: string | null
  sources: string[]
  loading: boolean
}) {
  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <footer className="footer-band relative mt-12 md:mt-16 text-white">
      <div className="relative z-10 mx-auto max-w-[1240px] px-3 sm:px-5 md:px-8 pt-28 md:pt-36 pb-[max(2rem,env(safe-area-inset-bottom))] md:pb-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[17px] font-medium tracking-[-0.015em]">Trading Dashboard</span>
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-[13px]">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/60">Zuletzt synced</dt>
                <dd className="mt-0.5 tabular">{loading ? '…' : lastSyncedAt ? fmtDate(lastSyncedAt) : 'nie'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/60">Quellen</dt>
                <dd className="mt-0.5 text-white/90">{sources.length > 0 ? sources.join(' · ') : 'Keine Verbindung'}</dd>
              </div>
            </dl>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={toTop} className="pill-on-dark h-11 px-5 text-sm">
              Nach oben
            </button>
            <Link href="/settings" className="pill-on-dark h-11 px-5 text-sm">
              <GearIcon />
              Einstellungen
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
