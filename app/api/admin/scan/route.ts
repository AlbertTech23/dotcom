import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isBusTraveler, TRAVEL_MODE_LABELS } from '@/lib/utils'
import { parseBody, serverError, enforceLimit } from '@/lib/api'
import { scanSchema } from '@/lib/schemas'
import type { Profile } from '@/types/database'

type ScanMember = Pick<Profile, 'id' | 'full_name' | 'status' | 'role' | 'seat_number' | 'travel_mode'>

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Auth + member lookup in parallel to cut scan latency (this is the hot path
  // the committee hits once per boarding member). The lookup runs under RLS —
  // member_private is admin/committee-only — so a non-admin caller's query
  // returns nothing anyway; we still gate every write on the role check below.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await enforceLimit('scan', user.id)
  if (limited) return limited

  const parsed = await parseBody(req, scanSchema)
  if ('res' in parsed) return parsed.res
  const { qr_token } = parsed.data

  const [callerRes, lookupRes] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    // One query: resolve qr_token → member_private → embedded profile fields,
    // instead of a separate token lookup followed by a profile fetch.
    supabase
      .from('member_private')
      .select('profiles!inner(id, full_name, status, role, seat_number, travel_mode)')
      .eq('qr_token', qr_token)
      .single(),
  ])

  const callerRole = (callerRes.data as { role?: string } | null)?.role
  if (!['admin', 'committee'].includes(callerRole ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const member = (lookupRes.data as { profiles: ScanMember } | null)?.profiles ?? null
  if (lookupRes.error || !member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.role === 'admin') return NextResponse.json({ error: 'Cannot scan admin QR' }, { status: 400 })
  // Setup Crew / Convoy don't ride the bus — there's nothing to board, so don't
  // flip a status for them (and keep them out of the on/off-bus tally).
  if (!isBusTraveler(member.travel_mode)) {
    return NextResponse.json(
      { error: `${member.full_name} isn't a bus passenger (${TRAVEL_MODE_LABELS[member.travel_mode]}) — no scan needed.` },
      { status: 400 },
    )
  }
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

  if (updateError) return serverError('scan.update', updateError)

  await supabase.from('status_logs').insert({
    member_id:  member.id,
    action,
    changed_by: user.id,
  })

  return NextResponse.json({ success: true, full_name: member.full_name, status: newStatus, action })
}
