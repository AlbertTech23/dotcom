import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// POST /api/admin/seats — assign a member to a seat
// Body: { memberId, busNumber, seatNumber }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { memberId, busNumber, seatNumber } = await req.json()
  if (!memberId || !busNumber || !seatNumber) {
    return NextResponse.json({ error: 'memberId, busNumber, seatNumber required' }, { status: 400 })
  }

  // Free up the target seat if it's already taken by someone else
  await supabase
    .from('profiles')
    .update({ bus_number: null, seat_number: null })
    .eq('bus_number', busNumber)
    .eq('seat_number', seatNumber)
    .neq('id', memberId)

  // Assign the member. A freshly-seated member hasn't boarded yet, so always
  // reset them to off_bus — boarding checks then start from a clean slate (the
  // committee flips them on when they scan in).
  const { error } = await supabase
    .from('profiles')
    .update({ bus_number: busNumber, seat_number: seatNumber, status: 'off_bus', last_changed_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE /api/admin/seats — unassign a member from their seat
// Body: { memberId }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { memberId } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ bus_number: null, seat_number: null })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
