import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireSuperAdmin } from '@/lib/supabase/require-admin'
import { isDuplicateEmail } from '@/lib/supabase/auth-errors'
import { parseBody } from '@/lib/api'
import { importSchema } from '@/lib/schemas'

// Bulk import creates member/committee accounts only — never admins.
const VALID_ROLES = ['committee', 'member']
const VALID_TRAVEL_MODES = ['bus', 'advance', 'convoy']

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, importSchema)
  if ('res' in parsed) return parsed.res
  const { members } = parsed.data

  // Assigning an elevated role (committee) is admin-only — committee can import
  // members but not escalate. Mirrors the single-member create endpoint.
  const wantsElevatedRole = members.some(m => VALID_ROLES.includes(m.role ?? '') && m.role !== 'member')
  if (wantsElevatedRole) {
    const notSuper = await requireSuperAdmin(supabase)
    if (notSuper) return notSuper
  }

  const admin = createAdminClient()
  const results: { email: string; success: boolean; error?: string }[] = []

  for (const m of members) {
    if (!m.email || !m.password || !m.full_name) {
      results.push({ email: m.email ?? '(unknown)', success: false, error: 'Missing required fields' })
      continue
    }

    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email:         m.email,
        password:      m.password,
        email_confirm: true,
      })

      if (authError || !authData.user) {
        const error = isDuplicateEmail(authError)
          ? 'Already registered'
          : authError?.message ?? 'Auth error'
        results.push({ email: m.email, success: false, error })
        continue
      }

      // Upsert: the on_auth_user_created trigger already inserted a profiles row.
      const { error: profileError } = await supabase.from('profiles').upsert({
        id:          authData.user.id,
        full_name:   m.full_name,
        role:        VALID_ROLES.includes(m.role ?? '') ? m.role : 'member',
        group_label: m.group_label ?? null,
        travel_mode: VALID_TRAVEL_MODES.includes(m.travel_mode ?? '') ? m.travel_mode : 'bus',
      })

      if (profileError) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ email: m.email, success: false, error: profileError.message })
        continue
      }

      // Sensitive fields go to member_private (upsert: trigger may have seeded the row).
      const { error: privateError } = await admin
        .from('member_private')
        .upsert({ id: authData.user.id, student_id: m.student_id ?? null, phone: m.phone ?? null })

      if (privateError) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ email: m.email, success: false, error: privateError.message })
        continue
      }

      results.push({ email: m.email, success: true })
    } catch (e) {
      results.push({ email: m.email, success: false, error: String(e) })
    }
  }

  const failed = results.filter(r => !r.success)
  return NextResponse.json({
    total:   members.length,
    created: results.filter(r => r.success).length,
    failed:  failed.length,
    errors:  failed,
  })
}
