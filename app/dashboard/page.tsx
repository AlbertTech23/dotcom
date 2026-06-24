import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { DashboardClient } from '@/components/DashboardClient'
import { PwaPrompt } from '@/components/PwaPrompt'
import { MyQrButton } from '@/components/MyQrButton'
import { exitAdminView } from '@/app/actions/admin-view'
import { UserCircle } from 'lucide-react'
import type { Profile, MemberPrivate } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  // Exclude pure admin accounts — they're not trip participants.
  // Admin will add member/committee profiles manually.
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['member', 'committee'])
    .order('full_name')

  // Admins/committee: merge in student_id/phone/qr_token for the table.
  const profiles = await mergePrivate(supabase, profilesData ?? [])

  // Committee are trip participants — surface their own QR here so they don't have
  // to detour to /me to be scanned. Pure admins have no QR.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: meData } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single()
  const myRole = (meData as Pick<Profile, 'role'> | null)?.role
  const isCommittee = myRole === 'committee'
  let myQrToken: string | null = null
  if (isCommittee && user) {
    const { data: priv } = await supabase.from('member_private').select('qr_token').eq('id', user.id).single()
    myQrToken = (priv as Pick<MemberPrivate, 'qr_token'> | null)?.qr_token ?? null
  }

  return (
    <div className="space-y-6">
      <PwaPrompt />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 id="onb-admin-header" className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        {myQrToken && <MyQrButton token={myQrToken} />}
      </div>

      {/* Committee: a prominent in-page switch back to the personal view. The nav
          bars also carry it, but this makes it discoverable on mobile. */}
      {isCommittee && (
        <form action={exitAdminView} className="md:hidden">
          <button type="submit"
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-left transition active:scale-[0.99]">
            <span className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <UserCircle size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Admin View</span>
                <span className="block text-xs text-amber-700 dark:text-amber-400">Tap to switch to your personal view</span>
              </span>
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Switch →</span>
          </button>
        </form>
      )}

      {/* Counter + table share one state so toggles update both instantly */}
      <DashboardClient initialProfiles={profiles ?? []} />
    </div>
  )
}
