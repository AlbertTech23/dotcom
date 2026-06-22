import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MapView } from '@/components/MapView'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const supabase = await createClient()
  // RLS (member_select_sharing) limits this to rows the user may see. Start it before
  // awaiting auth so it overlaps the getUser round-trip.
  const sharingPromise = supabase.from('profiles').select('*').eq('location_sharing', true)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `me` may not be in the sharing list (if not sharing), so fetch it — in parallel.
  const [{ data: meData }, { data: sharingData }] = await Promise.all([
    supabase.from('profiles').select('role, location_sharing').eq('id', user.id).single(),
    sharingPromise,
  ])
  const me = meData as Pick<Profile, 'role' | 'location_sharing'> | null
  const isPrivileged = me?.role === 'admin' || me?.role === 'committee'
  const sharing = (sharingData ?? []) as Profile[]

  return (
    <MapView
      initialProfiles={sharing}
      isPrivileged={isPrivileged}
      initialSharing={me?.location_sharing ?? false}
    />
  )
}
