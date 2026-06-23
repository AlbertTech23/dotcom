import { createClient } from '@/lib/supabase/server'
import type { Profile, MemberPrivate } from '@/types/database'
import { isAdminViewActive } from '@/lib/admin-view'
import { BottomNav } from './BottomNav'

/**
 * Server wrapper for the global bottom navigation. Resolves the current user's
 * role to decide the Home target and the center action, then renders the client
 * <BottomNav>. Renders nothing for unauthenticated requests (e.g. /login).
 */
export async function FooterNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const me = data as Pick<Profile, 'role'> | null
  if (!me) return null

  // Committee count as staff only while admin view is unlocked; otherwise they
  // navigate as members (Home → /me, their own QR in the center action).
  const isStaff = me.role === 'admin' || (me.role === 'committee' && await isAdminViewActive())

  // Members carry their QR in the nav; staff don't. qr_token now lives in
  // member_private (RLS lets a user read their own row).
  let qrToken: string | null = null
  if (!isStaff) {
    const { data: privData } = await supabase
      .from('member_private')
      .select('qr_token')
      .eq('id', user.id)
      .single()
    const priv = privData as Pick<MemberPrivate, 'qr_token'> | null
    qrToken = priv?.qr_token ?? null
  }

  return (
    <BottomNav
      isStaff={isStaff}
      homeHref={isStaff ? '/dashboard' : '/me'}
      qrToken={qrToken}
    />
  )
}
