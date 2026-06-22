'use client'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'
import { RotateCcw } from 'lucide-react'

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
            <div key={p.id} className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
              <span className="font-medium text-red-700 dark:text-red-200">{p.full_name}</span>
              {p.group_label && <span className="text-red-400 text-xs">({p.group_label})</span>}
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
