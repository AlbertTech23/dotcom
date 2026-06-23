'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { MapPin, X, Link2, Globe, Lock } from 'lucide-react'
import type { MapMarker, MarkerVisibility } from '@/types/database'

const ICONS = ['📍', '🚩', '🏡', '🍴', '⛽', '🅿️', '⚠️', '🏥', '🛕', '🏖️', '🚌', '☕']

interface Props {
  /** Provided when editing an existing pin; omit to create a new one. */
  marker?: MapMarker
  /** Starting location for a new pin (e.g. from a map tap). */
  initialLatLng?: { lat: number; lng: number } | null
  onClose: () => void
  onSaved: (marker: MapMarker) => void
}

/**
 * Create/edit a pin (committee/admin). Location comes from a map tap
 * (initialLatLng) or a pasted Google Maps link — resolved server-side via
 * /api/admin/maps-resolve so short links work. Visibility is public (everyone)
 * or private (committee/admin only), each with a plain description.
 */
export function MarkerForm({ marker, initialLatLng, onClose, onSaved }: Props) {
  const isEdit = !!marker
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(
    marker ? { lat: marker.latitude, lng: marker.longitude } : (initialLatLng ?? null),
  )
  const [label, setLabel] = useState(marker?.label ?? '')
  const [icon, setIcon] = useState(marker?.icon ?? '📍')
  const [visibility, setVisibility] = useState<MarkerVisibility>(marker?.visibility ?? 'public')
  const [link, setLink] = useState(marker?.source_url ?? '')
  // The original Google Maps link, kept so "Open in Maps" is the exact place —
  // not a coords-rebuilt link. Null for tap-placed pins.
  const [sourceUrl, setSourceUrl] = useState<string | null>(marker?.source_url ?? null)
  const [resolving, setResolving] = useState(false)
  const [saving, setSaving] = useState(false)

  async function resolveLink() {
    if (!link.trim()) return
    setResolving(true)
    try {
      const res = await fetch('/api/admin/maps-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read that link')
      setLatLng({ lat: data.lat, lng: data.lng })
      setSourceUrl(link.trim())
      toast.success('Location set from link')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that link')
    } finally {
      setResolving(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { toast.error('Give the pin a label'); return }
    if (!latLng) { toast.error('Set a location — tap the map or paste a link'); return }
    setSaving(true)
    try {
      const url = isEdit ? `/api/admin/markers/${marker!.id}` : '/api/admin/markers'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), icon, latitude: latLng.lat, longitude: latLng.lng, visibility, source_url: sourceUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save the pin')
      onSaved(data as MapMarker)
      toast.success(isEdit ? 'Pin updated' : 'Pin added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the pin')
      setSaving(false)
    }
  }

  const modal = (
    <div onClick={onClose} className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm sm:px-6">
      <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-sm bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin size={16} className="text-emerald-500" />{isEdit ? 'Edit pin' : 'Add a pin'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} autoFocus placeholder="e.g. Rest stop, Masjid, Foto spot"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Icon</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONS.map(emoji => (
                <button key={emoji} type="button" onClick={() => setIcon(emoji)}
                  className={`h-10 rounded-lg text-lg flex items-center justify-center transition border ${
                    icon === emoji
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Location</label>
            {latLng ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 mb-2">
                📍 {latLng.lat.toFixed(5)}, {latLng.lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-2">Tap the map to drop the pin, or paste a Google Maps link below.</p>
            )}
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Link2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste Google Maps link"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
              </div>
              <button type="button" onClick={resolveLink} disabled={resolving || !link.trim()}
                className="flex-shrink-0 text-xs font-semibold px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition">
                {resolving ? '…' : 'Use'}
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Who can see this pin?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setVisibility('public')}
                className={`text-left rounded-lg border p-2.5 transition ${visibility === 'public' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><Globe size={13} />Public</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Everyone — members & committee.</span>
              </button>
              <button type="button" onClick={() => setVisibility('private')}
                className={`text-left rounded-lg border p-2.5 transition ${visibility === 'private' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><Lock size={13} />Private</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Committee & admins only. Members won't see it.</span>
              </button>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add pin'}
          </button>
        </form>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
