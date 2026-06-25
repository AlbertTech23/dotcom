import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireSuperAdmin } from '@/lib/supabase/require-admin'
import { isDuplicateEmail } from '@/lib/supabase/auth-errors'
import { parseBody, serverError } from '@/lib/api'
import { memberCreateSchema } from '@/lib/schemas'

const VALID_TRAVEL_MODES = ['bus', 'advance', 'convoy']

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, memberCreateSchema)
  if ('res' in parsed) return parsed.res
  const { email, password, full_name, student_id, phone, group_label, room_id, role, travel_mode } = parsed.data

  // Default to member. Assigning an elevated role (admin/committee) at creation is
  // admin-only — committee can create members but not escalate (mirrors the role endpoint).
  const newRole = role ?? 'member'
  if (newRole !== 'member') {
    const notSuper = await requireSuperAdmin(supabase)
    if (notSuper) return notSuper
  }

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    // Supabase enforces email uniqueness in auth.users — turn its raw error into
    // a friendly, role-aware message (and a 409, since it's a conflict not a 500).
    if (isDuplicateEmail(authError)) {
      return NextResponse.json(
        { error: `${email} is already registered to a member.` },
        { status: 409 },
      )
    }
    return serverError('members.createUser', authError)
  }

  // Upsert (not insert): the on_auth_user_created trigger already created a
  // profiles row, so we update it here rather than collide on the primary key.
  const { error: profileError } = await supabase.from('profiles').upsert({
    id:          authData.user.id,
    full_name,
    role:        newRole,
    group_label: group_label ?? null,
    room_id:     room_id ?? null,
    travel_mode: travel_mode && VALID_TRAVEL_MODES.includes(travel_mode) ? travel_mode : 'bus',
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return serverError('members.profileUpsert', profileError)
  }

  // Sensitive fields go to member_private. Upsert (not insert) because the
  // on_auth_user_created trigger may have already seeded the row with a qr_token.
  const { error: privateError } = await admin
    .from('member_private')
    .upsert({ id: authData.user.id, student_id: student_id ?? null, phone: phone ?? null })

  if (privateError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return serverError('members.privateUpsert', privateError)
  }

  return NextResponse.json({ success: true, id: authData.user.id })
}
