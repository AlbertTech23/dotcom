import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isBusTraveler, TRAVEL_MODE_LABELS } from '@/lib/utils'
import type { TravelMode } from '@/types/database'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('status, full_name, seat_number, travel_mode')
    .eq('id', id)
    .single() as { data: { status: string; full_name: string; seat_number: number | null; travel_mode: TravelMode } | null; error: unknown }

  if (error || !profile) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Setup Crew / Convoy don't ride the bus, so there's no on/off status to flip.
  if (!isBusTraveler(profile.travel_mode)) {
    return NextResponse.json(
      { error: `${profile.full_name} isn't a bus passenger (${TRAVEL_MODE_LABELS[profile.travel_mode]}).` },
      { status: 400 },
    )
  }

  // Can't board a bus they have no seat on — require a seat first, otherwise the
  // roster accrues "on/off bus" rows for people with no seat (data debt).
  if (profile.seat_number == null) {
    return NextResponse.json(
      { error: `${profile.full_name} has no seat yet. Assign a seat first.` },
      { status: 409 },
    )
  }

  const newStatus = profile.status === 'on_bus' ? 'off_bus' : 'on_bus'
  const action    = newStatus === 'off_bus' ? 'out' : 'in'

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ status: newStatus, last_changed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('status_logs').insert({
    member_id:  id,
    action,
    changed_by: user!.id,
  })

  return NextResponse.json({ success: true, status: newStatus, action, full_name: profile.full_name })
}
