import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/supabase/require-admin'

const VALID_ROLES = ['admin', 'committee', 'member'] as const
type Role = typeof VALID_ROLES[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Role assignment is admin-only — committee must NOT be able to escalate
  // itself or others to admin.
  const guard = await requireSuperAdmin(supabase)
  if (guard) return guard

  // Don't let an admin change their own role (prevents accidental self-lockout
  // and self-demotion of the last admin).
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === id) {
    return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
  }

  const { role } = await request.json() as { role: Role }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, role })
}
