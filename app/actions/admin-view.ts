'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_VIEW_COOKIE, signedAdminViewValue } from '@/lib/admin-view'
import type { Profile } from '@/types/database'

export interface AdminViewState { error: string }

/**
 * Validate the admin-view code (server-side, against ADMIN_VIEW_CODE) and, on
 * success, set the admin_view cookie and send the committee member to the
 * dashboard. Only committee may enter — members have no admin view to unlock.
 */
export async function enterAdminView(
  _prev: AdminViewState,
  formData: FormData,
): Promise<AdminViewState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You are not signed in.' }

  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (data as Pick<Profile, 'role'> | null)?.role
  if (role !== 'committee') return { error: 'Admin view is only available to committee.' }

  const expected = process.env.ADMIN_VIEW_CODE
  if (!expected) return { error: 'Admin view code is not configured. Ask the admin to set ADMIN_VIEW_CODE.' }

  const code = String(formData.get('code') ?? '').trim()
  if (code !== expected) return { error: 'Incorrect code. Please try again.' }

  const store = await cookies()
  store.set(ADMIN_VIEW_COOKIE, await signedAdminViewValue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12h — re-enter the code next session
  })
  redirect('/dashboard')
}

/** Drop the admin-view flag and return to the personal view. */
export async function exitAdminView() {
  const store = await cookies()
  store.delete(ADMIN_VIEW_COOKIE)
  redirect('/me')
}
