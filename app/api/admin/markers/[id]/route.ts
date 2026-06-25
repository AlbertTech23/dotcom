import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isSafeHttpUrl } from '@/lib/utils'
import { parseBody, serverError } from '@/lib/api'
import { markerPatchSchema } from '@/lib/schemas'

// PATCH /api/admin/markers/[id] — edit a marker's label/icon/visibility/position.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, markerPatchSchema)
  if ('res' in parsed) return parsed.res
  const body = parsed.data
  const patch: Record<string, unknown> = {}
  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim()
  if (typeof body.icon === 'string') patch.icon = body.icon
  if (body.visibility === 'public' || body.visibility === 'private') patch.visibility = body.visibility
  if (typeof body.latitude === 'number') patch.latitude = body.latitude
  if (typeof body.longitude === 'number') patch.longitude = body.longitude
  if (typeof body.source_url === 'string') {
    const trimmed = body.source_url.trim()
    if (trimmed && !isSafeHttpUrl(trimmed)) {
      return NextResponse.json({ error: 'source_url must be a valid http(s) link' }, { status: 400 })
    }
    patch.source_url = trimmed || null
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase.from('map_markers').update(patch).eq('id', id).select().single()
  if (error) return serverError('markers.patch', error)
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
