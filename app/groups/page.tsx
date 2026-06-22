import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { GroupsView } from '@/components/GroupsView'
import type { Profile } from '@/types/database'
import { Users, ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const supabase = await createClient()
  // Start the roster query before awaiting auth so it overlaps the getUser round-trip.
  const profilesPromise = supabase.from('profiles').select('*').order('full_name')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profilesData } = await profilesPromise
  // Merge member_private (admins see all student_ids; members see only their own).
  const list = await mergePrivate(supabase, (profilesData ?? []) as Profile[])
  // Our own row is always within the roster (RLS member_select_own), so derive it
  // here instead of issuing a separate round-trip for it.
  const me = list.find(p => p.id === user.id) ?? null
  const isAdmin = me?.role === 'admin' || me?.role === 'committee'

  const groupCount = new Set(
    list.filter(p => p.role === 'member' && p.group_label).map(p => p.group_label)
  ).size

  const backHref = isAdmin ? '/dashboard' : '/me'

  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <a href={backHref} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </a>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <Users size={20} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Groups</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {groupCount} group{groupCount !== 1 ? 's' : ''} · {list.filter(p => p.role === 'member').length} members
          </p>
        </div>
      </div>

      <div id="onb-groups">
        <GroupsView initialProfiles={list} isAdmin={isAdmin} myGroupLabel={me?.group_label} />
      </div>
    </div>
  )
}
