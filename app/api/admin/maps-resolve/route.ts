import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { parseLatLngFromMapsUrl } from '@/lib/utils'

// POST /api/admin/maps-resolve — turn a pasted Google Maps link into coordinates.
// Short links (maps.app.goo.gl/…) carry no coords, so we follow the redirect
// server-side (no CORS in the browser) and parse the resolved URL, then the page
// body as a fallback. Committee/admin only — this only feeds marker creation.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Paste a Google Maps link' }, { status: 400 })
  }

  // Full URL pasted directly? Parse without a network call.
  let coords = parseLatLngFromMapsUrl(url)

  if (!coords) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DOTCOM/1.0)' },
      })
      coords = parseLatLngFromMapsUrl(res.url)
      if (!coords) coords = parseLatLngFromMapsUrl(await res.text())
    } catch {
      /* fall through to the 422 below */
    }
  }

  if (!coords) {
    return NextResponse.json(
      { error: "Couldn't read a location from that link. Try tapping the map instead." },
      { status: 422 },
    )
  }
  return NextResponse.json(coords)
}
