import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/supabase/require-admin'

// 'admin' is deliberately NOT assignable through the app — admins are seeded
// directly in the database. The app can only move people between member/committee.
const ASSIGNABLE_ROLES = ['committee', 'member'] as const
type Role = typeof ASSIGNABLE_ROLES[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Role assignment is admin-only — committee must NOT be able to escalate
  // itself or others.
  const guard = await requireSuperAdmin(supabase)
  if (guard) return guard

  // Don't let an admin change their own role (prevents accidental self-lockout
  // and self-demotion of the last admin).
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === id) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
  }

  const { role } = await request.json() as { role: Role }
  // Hard block: never allow granting admin via the API, under any circumstance.
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role must be member or committee' }, { status: 400 })
  }

  // Refuse to touch an existing admin's row through this endpoint either.
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).single()
  if ((target as { role?: string } | null)?.role === 'admin') {
    return NextResponse.json({ error: 'Cannot modify an admin account' }, { status: 403 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, role })
}
