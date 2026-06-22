'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OffBusCounter } from './OffBusCounter'
import { DataTable } from './DataTable'
import type { Profile } from '@/types/database'

/**
 * Owns the dashboard's profile state so the off-bus counter and the table stay in
 * sync: a toggle/reset updates local state immediately (instant, no refresh), and
 * a single realtime subscription folds in changes from other devices.
 */
export function DashboardClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('dashboard-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        setProfiles(prev => {
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== (payload.old as Profile).id)
          const row = payload.new as Profile
          if (payload.eventType === 'INSERT') return prev.some(p => p.id === row.id) ? prev : [...prev, row]
          return prev.map(p => p.id === row.id ? { ...p, ...row } : p)
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return (
    <>
      <OffBusCounter profiles={profiles} setProfiles={setProfiles} />
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">All Members</h2>
        <DataTable profiles={profiles} setProfiles={setProfiles} />
      </div>
    </>
  )
}
