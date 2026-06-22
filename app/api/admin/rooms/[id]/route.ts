import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// PATCH /api/admin/rooms/[id] — update room details
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.name   !== undefined) update.name     = body.name.trim() || null
  if (body.floor  !== undefined) update.floor    = body.floor  || null
  if (body.notes  !== undefined) update.notes    = body.notes  || null
  if (body.capacity !== undefined) update.capacity = body.capacity || null

  const { data, error } = await supabase
    .from('rooms')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/admin/rooms/[id] — delete room (members' room_id set to null via FK cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
