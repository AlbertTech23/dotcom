import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const body = await req.json()
  const { email, password, full_name, student_id, phone, group_label } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'email, password, and full_name are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id:          authData.user.id,
    full_name,
    role:        'member',
    group_label: group_label ?? null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Sensitive fields go to member_private. Upsert (not insert) because the
  // on_auth_user_created trigger may have already seeded the row with a qr_token.
  const { error: privateError } = await admin
    .from('member_private')
    .upsert({ id: authData.user.id, student_id: student_id ?? null, phone: phone ?? null })

  if (privateError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: privateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: authData.user.id })
}
