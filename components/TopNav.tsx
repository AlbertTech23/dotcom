import { createClient } from '@/lib/supabase/server'
import type { Profile, MemberPrivate } from '@/types/database'
import { isAdminViewActive } from '@/lib/admin-view'
import { DesktopNav } from './DesktopNav'

/**
 * Server wrapper for the desktop top navigation. Resolves role, location-sharing
 * state, and (for members) the QR token, then renders the client <DesktopNav>.
 * Renders nothing for unauthenticated requests (e.g. /login).
 */
export async function TopNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role, location_sharing')
    .eq('id', user.id)
    .single()
  const me = data as Pick<Profile, 'role' | 'location_sharing'> | null
  if (!me) return null

  const adminView = await isAdminViewActive()
  // Committee count as staff only while admin view is unlocked.
  const isStaff = me.role === 'admin' || (me.role === 'committee' && adminView)

  let qrToken: string | null = null
  if (!isStaff) {
    const { data: priv } = await supabase
      .from('member_private')
      .select('qr_token')
      .eq('id', user.id)
      .single()
    qrToken = (priv as Pick<MemberPrivate, 'qr_token'> | null)?.qr_token ?? null
  }

  return (
    <DesktopNav
      isStaff={isStaff}
      homeHref={isStaff ? '/dashboard' : '/me'}
      qrToken={qrToken}
      locationSharing={me.location_sharing ?? false}
      isCommittee={me.role === 'committee'}
      adminView={adminView}
    />
  )
}
