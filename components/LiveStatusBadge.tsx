'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from './StatusBadge'
import type { Status } from '@/types/database'

/**
 * Live status badge for /me. The change comes from the scanner (another device),
 * so unlike the admin views there's no local-update path — it needs realtime.
 * Realtime is the instant path; the poll is a fallback for dropped websockets.
 */
export function LiveStatusBadge({ id, initialStatus }: { id: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus)

  // Safety net for flaky mobile wifi. Keep true in production.
  const POLL_ENABLED = true

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let interval: ReturnType<typeof setInterval> | null = null

    // Re-read own row (RLS allows it) — used by the poll and visibility refetch.
    const refetch = async () => {
      const { data } = await supabase.from('profiles').select('status').eq('id', id).single()
      const next = (data as { status?: Status } | null)?.status
      if (active && next) setStatus(next)
    }

    // Instant path. setAuth() is required: without it the realtime socket is
    // unauthenticated and RLS drops every event (see realtime-needs-setauth note).
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel(`me-status-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles' },
          payload => {
            const row = payload.new as { id?: string; status?: Status }
            if (row.id === id && row.status) setStatus(row.status)
          },
        )
        .subscribe()
    })

    // Poll only while the tab is visible (saves battery; the member is watching
    // their screen as they're scanned anyway).
    const startPoll = () => { if (POLL_ENABLED && !interval) interval = setInterval(refetch, 4000) }
    const stopPoll  = () => { if (interval) { clearInterval(interval); interval = null } }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { refetch(); startPoll() }
      else stopPoll()
    }
    document.addEventListener('visibilitychange', onVisibility)

    refetch()    // catch changes between SSR and hydration
    startPoll()

    return () => {
      active = false
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
      if (channel) supabase.removeChannel(channel)
    }
  }, [id])

  return <StatusBadge status={status} />
}
