import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const body = await req.json()

  // Only touch columns the caller actually sent — otherwise an omitted field
  // (e.g. full_name) would be written as null and break the NOT NULL constraint.
  const profileUpdate: Record<string, unknown> = {}
  if (body.full_name   !== undefined) profileUpdate.full_name   = body.full_name
  if (body.group_label !== undefined) profileUpdate.group_label = body.group_label
  if (body.room_id     !== undefined) profileUpdate.room_id     = body.room_id ?? null
  if (body.travel_mode !== undefined && ['bus', 'advance', 'convoy'].includes(body.travel_mode)) {
    profileUpdate.travel_mode = body.travel_mode
    // Setup Crew / Convoy don't board, so vacate any bus seat they held — keeps
    // them off the bus map and out of the on/off-bus counts.
    if (body.travel_mode !== 'bus') {
      profileUpdate.bus_number  = null
      profileUpdate.seat_number = null
    }
  }
  // bus_number is intentionally NOT writable directly here — bus + seat are set
  // together on the Bus page so they never drift apart (the only exception is
  // clearing them above when a member stops being a bus traveler).

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // PII lives in member_private. Upsert only the provided fields so it works even
  // if the row is missing, without clobbering the other column.
  const privateUpdate: Record<string, unknown> = {}
  if (body.student_id !== undefined) privateUpdate.student_id = body.student_id ?? null
  if (body.phone      !== undefined) privateUpdate.phone      = body.phone ?? null

  if (Object.keys(privateUpdate).length > 0) {
    const { error: privateError } = await supabase
      .from('member_private')
      .upsert({ id, ...privateUpdate })
    if (privateError) return NextResponse.json({ error: privateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
