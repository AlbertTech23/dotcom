import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Members can't UPDATE their own profiles row (RLS only allows admin updates),
  // so use the service-role client scoped strictly to this user's own id.
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ has_seen_onboarding: true })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
