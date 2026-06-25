import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { parseBody, serverError } from '@/lib/api'
import { roomCreateSchema } from '@/lib/schemas'

// GET /api/admin/rooms — list all rooms
export async function GET() {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return serverError('rooms.list', error)
  return NextResponse.json(data)
}

// POST /api/admin/rooms — create a room
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, roomCreateSchema)
  if ('res' in parsed) return parsed.res
  const { name, floor, notes, capacity } = parsed.data

  const { data, error } = await supabase
    .from('rooms')
    .insert({ name: name.trim(), floor: floor || null, notes: notes || null, capacity: capacity || null })
    .select()
    .single()

  if (error) return serverError('rooms.create', error)
  return NextResponse.json(data, { status: 201 })
}
