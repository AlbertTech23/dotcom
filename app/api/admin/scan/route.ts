import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import type { Profile } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { data: { user } } = await supabase.auth.getUser()

  const { qr_token } = await req.json()
  if (!qr_token) return NextResponse.json({ error: 'Missing qr_token' }, { status: 400 })

  // qr_token now lives in member_private; requireAdmin above means is_admin() is
  // true, so RLS lets us look it up. Resolve the token to a member id, then load
  // the (non-sensitive) profile fields we need.
  const { data: privData } = await supabase
    .from('member_private')
    .select('id')
    .eq('qr_token', qr_token)
    .single()

  const priv = privData as { id: string } | null
  if (!priv) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const { data: memberData, error } = await supabase
    .from('profiles')
    .select('id, full_name, status, role, seat_number')
    .eq('id', priv.id)
    .single()

  const member = memberData as Pick<Profile, 'id' | 'full_name' | 'status' | 'role' | 'seat_number'> | null
  if (error || !member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.role === 'admin') return NextResponse.json({ error: 'Cannot scan admin QR' }, { status: 400 })
  // Require a seat before marking on/off (avoids status rows for members with no
  // seat — see the manual toggle route for the same gate).
  if (member.seat_number == null) {
    return NextResponse.json(
      { error: `${member.full_name} has no seat yet. Assign a seat first.` },
      { status: 409 },
    )
  }

  const newStatus = member.status === 'on_bus' ? 'off_bus' : 'on_bus'
  const action    = newStatus === 'off_bus' ? 'out' : 'in'

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ status: newStatus, last_changed_at: new Date().toISOString() })
    .eq('id', member.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('status_logs').insert({
    member_id:  member.id,
    action,
    changed_by: user!.id,
  })

  return NextResponse.json({ success: true, full_name: member.full_name, status: newStatus, action })
}
