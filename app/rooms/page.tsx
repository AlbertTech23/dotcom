import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { RoomsView } from '@/components/RoomsView'
import type { Profile, Room } from '@/types/database'
import { Building2, ChevronLeft } from 'lucide-react'

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

  const assigned = profiles.filter(p => p.role === 'member' && p.room_id !== null).length

  const backHref = isAdmin ? '/dashboard' : '/me'

  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <a href={backHref} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </a>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <Building2 size={20} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Rooms</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {assigned} assigned
          </p>
        </div>
      </div>

      <div id="onb-rooms">
        <RoomsView initialRooms={rooms} initialProfiles={profiles} isAdmin={isAdmin} myRoomId={me?.room_id} />
      </div>
    </div>
  )
}
