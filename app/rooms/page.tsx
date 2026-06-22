import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { RoomsView } from '@/components/RoomsView'
import type { Profile, Room } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const supabase = await createClient()
  // Start data queries before awaiting auth so they overlap the getUser round-trip.
  const roomsPromise = supabase.from('rooms').select('*').order('name')
  const profilesPromise = supabase.from('profiles').select('*').order('full_name')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: roomsData }, { data: profilesData }] = await Promise.all([roomsPromise, profilesPromise])
  const rooms = (roomsData ?? []) as Room[]
  // Merge member_private (admins see all student_ids; members see only their own).
  const profiles = await mergePrivate(supabase, (profilesData ?? []) as Profile[])
  // Own row is always within the roster (RLS member_select_own) — derive it.
  const me = profiles.find(p => p.id === user.id) ?? null
  const isAdmin = me?.role === 'admin' || me?.role === 'committee'

  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <RoomsView initialRooms={rooms} initialProfiles={profiles} isAdmin={isAdmin} myRoomId={me?.room_id} />
    </div>
  )
}
