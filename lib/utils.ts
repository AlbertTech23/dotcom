import type { Status, TravelMode } from '@/types/database'

export function statusLabel(s: Status) {
  return s === 'on_bus' ? 'On Bus' : 'Off Bus'
}

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  bus:     'Bus',
  advance: 'Setup Crew',
  convoy:  'Convoy',
}

/** Bus travelers are the only ones tracked for on/off-bus boarding — they're the
 *  ones counted, scanned, and seated. Setup Crew (advance) and Convoy travel on
 *  their own, so they're excluded from those flows but keep every other feature. */
export function isBusTraveler(mode: TravelMode | null | undefined): boolean {
  return (mode ?? 'bus') === 'bus'
}

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Convert Indonesian phone numbers to WhatsApp-compatible international format.
 *  08xx... → 628xx...   +628xx... → 628xx...   628xx... → unchanged */
export function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0'))  return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}

/** Link that opens a coordinate in Google Maps (web or the app). */
export function gmapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/** Best-effort extraction of lat/lng from a (resolved) Google Maps URL or page.
 *  Handles the common shapes: .../@lat,lng,zoom · ?q=lat,lng · !3dlat!4dlng */
export function parseLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|destination|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng }
      }
    }
  }
  return null
}
