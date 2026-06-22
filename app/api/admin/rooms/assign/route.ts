import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// POST /api/admin/rooms/assign — assign member to a room
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { memberId, roomId } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ room_id: roomId ?? null })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
