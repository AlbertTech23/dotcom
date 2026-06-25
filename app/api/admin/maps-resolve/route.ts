import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { parseLatLngFromMapsUrl, isAllowedMapsHost } from '@/lib/utils'
import { parseBody } from '@/lib/api'
import { mapsResolveSchema } from '@/lib/schemas'

// Follow a Google Maps short link to its destination WITHOUT letting it reach
// internal infrastructure (SSRF guard): every hop's host must be a Google Maps
// domain, redirects are followed manually (max 5), and each request has a 5s
// timeout. Returns the final resolved URL, or null if any hop is disallowed.
async function resolveAllowedUrl(startUrl: string): Promise<string | null> {
  let current = startUrl
  for (let hop = 0; hop < 5; hop++) {
    if (!isAllowedMapsHost(current)) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    let res: Response
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DOTCOM/1.0)' },
      })
    } finally {
      clearTimeout(timer)
    }
    // Redirect? Resolve the Location against the current URL and re-validate the host.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      current = new URL(loc, current).toString()
      continue
    }
    // Terminal response — make the body available to the caller via a sentinel.
    return current
  }
  return null
}

// POST /api/admin/maps-resolve — turn a pasted Google Maps link into coordinates.
// Short links (maps.app.goo.gl/…) carry no coords, so we follow the redirect
// server-side (no CORS in the browser) and parse the resolved URL, then the page
// body as a fallback. Committee/admin only — this only feeds marker creation.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const denied = await requireAdmin(supabase)
  if (denied) return denied

  const parsed = await parseBody(req, mapsResolveSchema)
  if ('res' in parsed) return parsed.res
  const { url } = parsed.data

  // Full URL pasted directly? Parse without a network call.
  let coords = parseLatLngFromMapsUrl(url)

  // Only do a network round-trip for Google Maps short links (no coords inline).
  // Anything else is rejected before fetch — prevents SSRF to internal hosts.
  if (!coords && isAllowedMapsHost(url)) {
    try {
      const resolvedUrl = await resolveAllowedUrl(url)
      if (resolvedUrl) {
        coords = parseLatLngFromMapsUrl(resolvedUrl)
        if (!coords) {
          // Re-fetch the terminal (already host-validated) URL to read its body.
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 5000)
          try {
            const res = await fetch(resolvedUrl, {
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DOTCOM/1.0)' },
            })
            coords = parseLatLngFromMapsUrl(await res.text())
          } finally {
            clearTimeout(timer)
          }
        }
      }
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
