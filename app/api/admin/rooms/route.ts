import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// GET /api/admin/rooms — list all rooms
export async function GET() {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/admin/rooms — create a room
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { name, floor, notes, capacity } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ name: name.trim(), floor: floor || null, notes: notes || null, capacity: capacity || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
