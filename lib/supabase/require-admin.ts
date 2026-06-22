import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Call at the top of every /api/admin/* route handler.
 * Returns a 401/403 NextResponse if the caller isn't an admin,
 * or null if the check passes (meaning you can proceed).
 */
export async function requireAdmin(supabase: Pick<SupabaseClient, 'auth' | 'from'>): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'committee'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}

/**
 * Stricter variant for operations that define the admin/committee trust boundary
 * (e.g. assigning roles). Only a true 'admin' passes — committee is rejected, so
 * a committee user can't escalate themselves or anyone else to admin.
 */
export async function requireSuperAdmin(supabase: Pick<SupabaseClient, 'auth' | 'from'>): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
