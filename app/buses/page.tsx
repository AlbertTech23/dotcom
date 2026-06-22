import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { BusesView } from '@/components/BusesView'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function BusesPage() {
  const supabase = await createClient()
  // Start the roster query before awaiting auth so it overlaps the getUser round-trip.
  const profilesPromise = supabase.from('profiles').select('*').order('full_name')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilesData } = await profilesPromise
  // Merge member_private: admins/committee get student_id for everyone, a plain
  // member gets it only for their own row (RLS on member_private enforces this).
  const profiles = await mergePrivate(supabase, (profilesData ?? []) as Profile[])
  // Own row is always within the roster (RLS member_select_own) — derive it.
  const me = profiles.find(p => p.id === user.id) ?? null
  const isAdmin = me?.role === 'admin' || me?.role === 'committee'

  return (
    <BusesView
      initialProfiles={profiles}
      isAdmin={isAdmin}
      myBusNumber={me?.bus_number ?? null}
      mySeatNumber={me?.seat_number ?? null}
    />
  )
}
