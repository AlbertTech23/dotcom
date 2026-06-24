'use client'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toWaNumber } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { RotateCcw, ChevronRight } from 'lucide-react'

/** WhatsApp deep-link nudging an off-bus member to come back. */
function waHref(p: Profile) {
  const firstName = p.full_name.split(/\s+/)[0]
  const text = `Halo ${firstName}, kamu masih tercatat OFF BUS di DOTA REBOOT 2026. Mohon segera kembali ke bus ya \u{1F64F}`
  return `https://wa.me/${toWaNumber(p.phone!)}?text=${encodeURIComponent(text)}`
}

// Controlled: shares profile state with the rest of the dashboard so a toggle in
// the table instantly updates this counter (no realtime dependency).
export function OffBusCounter({
  profiles,
  setProfiles,
}: {
  profiles: Profile[]
  setProfiles: Dispatch<SetStateAction<Profile[]>>
}) {
  const [resetting, setResetting] = useState(false)
  const router = useRouter()

  const offBus = profiles.filter(p => p.status === 'off_bus' && p.role !== 'admin')
  const total  = profiles.filter(p => p.role !== 'admin').length

  async function resetAll() {
    setResetting(true)
    const res = await fetch('/api/admin/reset-all', { method: 'POST' })
    setResetting(false)
    if (res.ok) {
      setProfiles(prev => prev.map(p => p.role !== 'admin' ? { ...p, status: 'on_bus' } : p))
      toast.success('All marked on bus')
    } else toast.error('Failed to reset')
  }

  return (
    <div id="onb-counter" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      {/* Big counter */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
        <div className="text-center sm:text-left">
          <span className={`text-6xl sm:text-7xl font-black tabular-nums ${offBus.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {offBus.length}
          </span>
          <p className="text-slate-500 text-sm mt-1">of {total} still off the bus</p>
        </div>
        {offBus.length === 0 && (
          <div className="flex-1 text-center">
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">Everyone&apos;s on board!</p>
          </div>
        )}
      </div>

      {/* Off-bus name list */}
      {offBus.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {offBus.map(p => (
            <div
              key={p.id}
              onClick={() => router.push(`/dashboard/members/${p.id}`)}
              className="group flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-1.5 cursor-pointer hover:border-red-300 dark:hover:border-red-800 hover:bg-red-100/60 dark:hover:bg-red-900/30 transition"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
              <span className="font-medium text-red-700 dark:text-red-200 truncate">{p.full_name}</span>
              {p.group_label && <span className="text-red-400 text-xs flex-shrink-0">({p.group_label})</span>}

              <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                {p.phone && (
                  <a
                    href={waHref(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    aria-label={`WhatsApp ${p.full_name}`}
                    title={`WhatsApp ${p.full_name}`}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.336-1.508A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.988-1.362l-.358-.213-3.76.896.952-3.653-.234-.374A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                    </svg>
                  </a>
                )}
                <ChevronRight size={15} className="text-red-300 dark:text-red-700 group-hover:text-red-500 dark:group-hover:text-red-400 transition" />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Reset button */}
      <button
        onClick={resetAll}
        disabled={resetting}
        className="w-full border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium py-2 rounded-lg transition disabled:opacity-50"
      >
        <span className="flex items-center justify-center gap-1.5">
          <RotateCcw size={14} />
          {resetting ? 'Resetting…' : 'Reset all to On Bus'}
        </span>
      </button>
    </div>
  )
}
