import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { GroupsView } from '@/components/GroupsView'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const supabase = await createClient()
  // Start the roster query before awaiting auth so it overlaps the getUser round-trip.
  const profilesPromise = supabase.from('profiles').select('*').order('full_name')
  const groupsPromise = supabase.from('groups').select('name').order('name')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilesData } = await profilesPromise
  // Merge member_private (admins see all student_ids; members see only their own).
  const list = await mergePrivate(supabase, (profilesData ?? []) as Profile[])
  const { data: groupsData } = await groupsPromise
  const persistedGroups = ((groupsData ?? []) as { name: string }[]).map(g => g.name)
  // Our own row is always within the roster (RLS member_select_own), so derive it
  // here instead of issuing a separate round-trip for it.
  const me = list.find(p => p.id === user.id) ?? null
  const isAdmin = me?.role === 'admin' || me?.role === 'committee'

  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <GroupsView initialProfiles={list} persistedGroups={persistedGroups} isAdmin={isAdmin} myGroupLabel={me?.group_label} />
    </div>
  )
}
