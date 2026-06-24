'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from './StatusBadge'
import type { Status } from '@/types/database'

/**
 * Member-facing status badge that stays live. The /me page is a Server Component
 * rendered once at request time, so without this a member would have to refresh
 * to see a scan take effect. We subscribe to changes on the member's OWN profile
 * row (RLS allows reading it) and update in place.
 */
export function LiveStatusBadge({ id, initialStatus }: { id: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`me-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` },
        payload => {
          const next = (payload.new as { status?: Status }).status
          if (next) setStatus(next)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  return <StatusBadge status={status} />
}
