import { createClient } from '@/lib/supabase/server'
import { mergePrivate } from '@/lib/supabase/with-private'
import { DashboardClient } from '@/components/DashboardClient'
import { MyQrButton } from '@/components/MyQrButton'
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 id="onb-admin-header" className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        {myQrToken && <MyQrButton token={myQrToken} />}
      </div>

      {/* Counter + table share one state so toggles update both instantly */}
      <DashboardClient initialProfiles={profiles ?? []} />
    </div>
  )
}
