import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isSafeHttpUrl } from '@/lib/utils'
import { parseBody, serverError } from '@/lib/api'
import { markerCreateSchema } from '@/lib/schemas'

// POST /api/admin/markers — create a map marker (committee/admin only via RLS).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, markerCreateSchema)
  if ('res' in parsed) return parsed.res
  const { label, icon, latitude, longitude, visibility, source_url } = parsed.data
  // Reject dangerous URL schemes (javascript:, data:) — source_url is later rendered
  // as an "Open in Maps" href, so only http(s) is allowed.
  if (source_url != null && source_url !== '' && !isSafeHttpUrl(source_url)) {
    return NextResponse.json({ error: 'source_url must be a valid http(s) link' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('map_markers')
    .insert({
      label: label.trim(),
      icon: icon || '📍',
      latitude,
      longitude,
      visibility: visibility === 'private' ? 'private' : 'public',
      source_url: isSafeHttpUrl(source_url) ? source_url.trim() : null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return serverError('markers.create', error)
  return NextResponse.json(data, { status: 201 })
}
