import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/supabase/require-admin'
import { parseBody, serverError } from '@/lib/api'
import { roleSchema } from '@/lib/schemas'

// 'admin' is deliberately NOT assignable through the app — admins are seeded
// directly in the database. The app can only move people between member/committee.

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

  // Hard block: never allow granting admin via the API — the schema only accepts
  // member/committee, so any other value is rejected with a 400.
  const parsed = await parseBody(request, roleSchema)
  if ('res' in parsed) return parsed.res
  const { role } = parsed.data

  // Refuse to touch an existing admin's row through this endpoint either.
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).single()
  if ((target as { role?: string } | null)?.role === 'admin') {
    return NextResponse.json({ error: 'Cannot modify an admin account' }, { status: 403 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)

  if (error) return serverError('members.role', error)
  return NextResponse.json({ ok: true, role })
}
