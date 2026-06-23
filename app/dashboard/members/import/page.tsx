import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MemberImport } from '@/components/MemberImport'
import type { Profile } from '@/types/database'
import { ChevronLeft, FileSpreadsheet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ImportMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: meData } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  // Only true admins may import committee accounts (committee can't escalate).
  const canAssignRole = (meData as Pick<Profile, 'role'> | null)?.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </Link>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <FileSpreadsheet size={20} className="text-emerald-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Import Members</h1>
          <p className="text-slate-500 text-xs mt-0.5">Bulk-create members from an Excel roster</p>
        </div>
      </div>

      <MemberImport canAssignRole={canAssignRole} />
    </div>
  )
}
