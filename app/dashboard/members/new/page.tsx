import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MemberForm } from '@/components/MemberForm'
import type { Profile, Room } from '@/types/database'
import { ChevronLeft, UserPlus, FileSpreadsheet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewMemberPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: roomsData }, { data: groupRows }, { data: meData }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('profiles').select('group_label'),
    supabase.from('profiles').select('role').eq('id', user?.id ?? '').single(),
  ])
  const rooms = (roomsData ?? []) as Room[]
  // Only true admins may assign a role at creation.
  const viewerIsAdmin = (meData as Pick<Profile, 'role'> | null)?.role === 'admin'
  const groups = Array.from(
    new Set(((groupRows ?? []) as { group_label: string | null }[])
      .map(r => r.group_label)
      .filter((g): g is string => !!g)),
  ).sort()

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </Link>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <UserPlus size={20} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add Member</h1>
          <p className="text-slate-500 text-xs mt-0.5">Create a new member account</p>
        </div>
        <Link href="/dashboard/members/import" title="Import from Excel"
          className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex-shrink-0">
          <FileSpreadsheet size={15} /><span className="hidden sm:inline">Import Excel</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <MemberForm mode="create" rooms={rooms} groups={groups} canAssignRole={viewerIsAdmin} />
      </div>
    </div>
  )
}
