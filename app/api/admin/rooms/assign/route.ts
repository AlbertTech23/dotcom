import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { parseBody, serverError } from '@/lib/api'
import { roomAssignSchema } from '@/lib/schemas'

// POST /api/admin/rooms/assign — assign member to a room
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, roomAssignSchema)
  if ('res' in parsed) return parsed.res
  const { memberId, roomId } = parsed.data

  const { error } = await supabase
    .from('profiles')
    .update({ room_id: roomId ?? null })
    .eq('id', memberId)

  if (error) return serverError('rooms.assign', error)
  return NextResponse.json({ ok: true })
}
