import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// PATCH /api/admin/markers/[id] — edit a marker's label/icon/visibility/position.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim()
  if (typeof body.icon === 'string') patch.icon = body.icon
  if (body.visibility === 'public' || body.visibility === 'private') patch.visibility = body.visibility
  if (typeof body.latitude === 'number') patch.latitude = body.latitude
  if (typeof body.longitude === 'number') patch.longitude = body.longitude
  if (typeof body.source_url === 'string') patch.source_url = body.source_url.trim() || null
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase.from('map_markers').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/admin/markers/[id] — remove a marker.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { error } = await supabase.from('map_markers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
