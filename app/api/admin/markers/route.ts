import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// POST /api/admin/markers — create a map marker (committee/admin only via RLS).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { label, icon, latitude, longitude, visibility, source_url } = await req.json()
  if (!label?.trim()) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ error: 'A valid location is required' }, { status: 400 })
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
      source_url: typeof source_url === 'string' && source_url.trim() ? source_url.trim() : null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
