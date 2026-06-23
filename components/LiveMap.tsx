'use client'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents, ZoomControl, Polyline, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { MarkerForm } from '@/components/MarkerForm'
import type { Profile, MapMarker } from '@/types/database'
import { formatTime, gmapsUrl } from '@/lib/utils'
import { Plus, Ruler, X, Trash2, Pencil, SlidersHorizontal } from 'lucide-react'

// Custom circle marker — avoids the default Leaflet icon image issue
function makeIcon(status: 'on_bus' | 'off_bus') {
  const color = status === 'on_bus' ? '#34d399' : '#f87171'
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.5)
    "></div>`,
    className: '',
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
    popupAnchor:[0, -10],
  })
}

// Fixed reference points for the trip — always shown on the map. The gmaps links
// open the exact named place (nicer than a bare coordinate).
const PINNED_PLACES = [
  { name: 'Titik Kumpul — UMN', lat: -6.256738,  lng: 106.6183029, emoji: '🚩', gmaps: 'https://maps.app.goo.gl/Hye219MgcUd7os548' },
  { name: 'Villa Teras Air',     lat: -6.6850739, lng: 106.925747,  emoji: '🏡', gmaps: 'https://maps.app.goo.gl/GpWSUzjKHkZQwWh4A' },
]

function makeEmojiIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6))">${emoji}</div>`,
    className: '',
    iconSize:   [26, 26],
    iconAnchor: [13, 26],
    popupAnchor:[0, -24],
  })
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number) {
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}

// Forces Leaflet to re-read container dimensions after React finishes layout.
function InvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 0)
    return () => clearTimeout(id)
  }, [map])
  return null
}

// Bridges Leaflet map clicks to React state (placing a pin / measuring).
function MapClicks({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

const DEFAULT_CENTER: [number, number] = [-6.4709, 106.772]

interface Props {
  initialProfiles: Profile[]
  initialMarkers: MapMarker[]
  isPrivileged: boolean
}

type Mode = 'idle' | 'placing' | 'ruler'

export default function LiveMap({ initialProfiles, initialMarkers, isPrivileged }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [markers, setMarkers] = useState(initialMarkers)
  const [mode, setMode] = useState<Mode>('idle')
  const [rulerPts, setRulerPts] = useState<{ lat: number; lng: number }[]>([])
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [routing, setRouting] = useState(false)
  const [form, setForm] = useState<
    | { kind: 'create'; latLng: { lat: number; lng: number } | null }
    | { kind: 'edit'; marker: MapMarker }
    | null
  >(null)
  // Layer/label filters — all on by default; the filter button toggles them.
  const [filters, setFilters] = useState({ places: true, pins: true, members: true, labels: true })
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRows = [
    { key: 'places' as const, label: 'Trip places' },
    { key: 'pins' as const, label: 'Pins' },
    { key: 'members' as const, label: 'Members' },
    { key: 'labels' as const, label: 'Labels' },
  ]

  // Realtime — member pins
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setProfiles(prev => {
            const updated = payload.new as Profile
            if (!updated.location_sharing) return prev.filter(p => p.id !== updated.id)
            const exists = prev.find(p => p.id === updated.id)
            return exists ? prev.map(p => p.id === updated.id ? { ...p, ...updated } : p) : [...prev, updated]
          })
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Realtime — map markers. Defense-in-depth: never surface a private pin to a
  // non-privileged viewer even if a realtime event slips through.
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('live-map-markers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_markers' }, payload => {
        if (payload.eventType === 'DELETE') {
          setMarkers(prev => prev.filter(m => m.id !== payload.old.id))
          return
        }
        const m = payload.new as MapMarker
        if (!isPrivileged && m.visibility === 'private') {
          setMarkers(prev => prev.filter(x => x.id !== m.id))
          return
        }
        setMarkers(prev => {
          const exists = prev.find(x => x.id === m.id)
          return exists ? prev.map(x => x.id === m.id ? m : x) : [...prev, m]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [isPrivileged])

  function addRulerPoint(lat: number, lng: number) {
    setRouteLine(null)
    setRouteInfo(null)
    setRulerPts(prev => (prev.length >= 2 ? [{ lat, lng }] : [...prev, { lat, lng }]))
  }

  function clearRuler() {
    setRulerPts([])
    setRouteLine(null)
    setRouteInfo(null)
  }

  async function routeByRoad() {
    if (rulerPts.length !== 2) return
    setRouting(true)
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: rulerPts[0], end: rulerPts[1] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Routing failed')
      setRouteLine(data.geometry)
      setRouteInfo({ distance: data.distance, duration: data.duration })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Routing failed')
    } finally {
      setRouting(false)
    }
  }

  function handleMapClick(lat: number, lng: number) {
    if (mode === 'placing') {
      setForm({ kind: 'create', latLng: { lat, lng } })
      setMode('idle')
    } else if (mode === 'ruler') {
      addRulerPoint(lat, lng)
    }
  }

  async function deleteMarker(id: string) {
    const prev = markers
    setMarkers(p => p.filter(m => m.id !== id)) // optimistic
    const res = await fetch(`/api/admin/markers/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setMarkers(prev)
      toast.error('Could not delete the pin')
    }
  }

  const visible = profiles.filter(p => p.location_sharing && p.latitude != null && p.longitude != null)
  const center: [number, number] = visible.length > 0
    ? [
        visible.reduce((s, p) => s + p.latitude!, 0) / visible.length,
        visible.reduce((s, p) => s + p.longitude!, 0) / visible.length,
      ]
    : DEFAULT_CENTER

  // Always a clean light streets basemap (CARTO Voyager) — easier to read than the
  // dark tiles, in both light and dark app themes. Free, supports retina + subdomains.
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

  const rulerDist = rulerPts.length === 2
    ? L.latLng(rulerPts[0].lat, rulerPts[0].lng).distanceTo(L.latLng(rulerPts[1].lat, rulerPts[1].lng))
    : null

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={visible.length > 0 ? 14 : 10}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <InvalidateOnMount />
        <ZoomControl position="bottomright" />
        <MapClicks onClick={handleMapClick} />
        <TileLayer key={tileUrl} url={tileUrl} attribution={tileAttribution} subdomains="abcd" />

        {/* Fixed trip reference pins */}
        {filters.places && PINNED_PLACES.map(place => (
          // key includes labels so the marker re-mounts and re-binds its tooltip —
          // react-leaflet's Tooltip `permanent` prop isn't reactive after mount.
          <Marker
            key={`${place.name}-${filters.labels}`}
            position={[place.lat, place.lng]}
            icon={makeEmojiIcon(place.emoji)}
            eventHandlers={{ click: () => { if (mode === 'ruler') addRulerPoint(place.lat, place.lng) } }}
          >
            <Tooltip permanent={filters.labels} direction="top" offset={[0, -24]}>{place.name}</Tooltip>
            {mode !== 'ruler' && (
              <Popup>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">{place.name}</p>
                  <a href={place.gmaps} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-medium hover:underline">Open in Google Maps ↗</a>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        {/* Committee/admin-placed pins */}
        {filters.pins && markers.map(m => (
          <Marker
            key={`${m.id}-${filters.labels}`}
            position={[m.latitude, m.longitude]}
            icon={makeEmojiIcon(m.icon)}
            eventHandlers={{ click: () => { if (mode === 'ruler') addRulerPoint(m.latitude, m.longitude) } }}
          >
            <Tooltip permanent={filters.labels} direction="top" offset={[0, -24]}>{m.label}</Tooltip>
            {mode !== 'ruler' && (
            <Popup>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">{m.label}</p>
                  {isPrivileged && (
                    <span className={`text-[9px] font-bold uppercase rounded px-1 py-0.5 ${m.visibility === 'private' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {m.visibility}
                    </span>
                  )}
                </div>
                <a href={m.source_url || gmapsUrl(m.latitude, m.longitude)} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 font-medium hover:underline">Open in Google Maps ↗</a>
                {isPrivileged && (
                  <div className="flex items-center gap-3 pt-0.5">
                    <button onClick={() => setForm({ kind: 'edit', marker: m })} className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
                      <Pencil size={12} />Edit
                    </button>
                    <button onClick={() => deleteMarker(m.id)} className="flex items-center gap-1 text-xs text-red-600 font-medium hover:underline">
                      <Trash2 size={12} />Delete
                    </button>
                  </div>
                )}
              </div>
            </Popup>
            )}
          </Marker>
        ))}

        {/* Member pins */}
        {filters.members && visible.map(p => (
          <Marker
            key={p.id}
            position={[p.latitude!, p.longitude!]}
            icon={makeIcon(p.status)}
            eventHandlers={{ click: () => { if (mode === 'ruler') addRulerPoint(p.latitude!, p.longitude!) } }}
          >
            {mode !== 'ruler' && (
            <Popup>
              <div className="space-y-0.5 text-sm">
                <p className="font-semibold">{p.full_name}</p>
                {p.group_label && <p className="text-slate-500 text-xs">{p.group_label}</p>}
                <p className={`font-semibold text-xs ${p.status === 'on_bus' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {p.status === 'on_bus' ? 'On Bus' : 'Off Bus'}
                </p>
                <p className="text-slate-400 text-xs">Updated {formatTime(p.location_updated_at)}</p>
              </div>
            </Popup>
            )}
          </Marker>
        ))}

        {/* Ruler overlay */}
        {rulerPts.map((pt, i) => (
          <CircleMarker key={i} center={[pt.lat, pt.lng]} radius={5} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }} />
        ))}
        {rulerPts.length === 2 && (
          <Polyline positions={rulerPts.map(p => [p.lat, p.lng])} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 6' }} />
        )}
        {routeLine && (
          <Polyline positions={routeLine} pathOptions={{ color: '#1d4ed8', weight: 5, opacity: 0.85 }} />
        )}
      </MapContainer>

      {/* ── Toolbar (left, below the floating header) ── */}
      <div className="absolute top-20 left-3 z-[600] flex flex-col gap-2">
        <button
          onClick={() => setFilterOpen(o => !o)}
          title="Filter map"
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition ${
            filterOpen ? 'bg-slate-700 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
        <button
          onClick={() => { setMode(mode === 'ruler' ? 'idle' : 'ruler'); setRulerPts([]) }}
          title="Measure distance"
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition ${
            mode === 'ruler' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Ruler size={18} />
        </button>
        {isPrivileged && (
          <button
            onClick={() => setMode(mode === 'placing' ? 'idle' : 'placing')}
            title="Add a pin"
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition ${
              mode === 'placing' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* ── Filter panel (tap outside or the filter icon again to close) ── */}
      {filterOpen && (
        <button aria-label="Close filter" onClick={() => setFilterOpen(false)} className="absolute inset-0 z-[590] cursor-default" />
      )}
      {filterOpen && (
        <div className="absolute top-20 left-16 z-[600] w-44 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-2">
          <div className="flex items-center justify-between px-1.5 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Show on map</p>
            <button onClick={() => setFilterOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={13} /></button>
          </div>
          <div className="pt-1">
          {filterRows.map(row => (
            <label key={row.key} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filters[row.key]}
                onChange={e => setFilters(f => ({ ...f, [row.key]: e.target.checked }))}
                className="accent-emerald-500 w-4 h-4"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.label}</span>
            </label>
          ))}
          </div>
        </div>
      )}

      {/* ── Mode banner (above the bottom nav) ── */}
      {mode === 'placing' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 bg-slate-900/85 backdrop-blur-sm text-white text-xs rounded-full pl-4 pr-2 py-2 shadow-lg whitespace-nowrap">
          Tap the map to place a pin
          <button onClick={() => { setMode('idle'); setForm({ kind: 'create', latLng: null }) }} className="font-semibold bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition">Add by link</button>
          <button onClick={() => setMode('idle')} aria-label="Cancel" className="text-white/70 hover:text-white p-1"><X size={14} /></button>
        </div>
      )}
      {mode === 'ruler' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[600] flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-sm text-white text-xs rounded-full pl-4 pr-2 py-2 shadow-lg whitespace-nowrap">
            {routeInfo ? (
              <span className="font-semibold">{formatDistance(routeInfo.distance)} · ~{formatDuration(routeInfo.duration)} <span className="font-normal text-white/60">by road</span></span>
            ) : rulerDist != null ? (
              <span className="font-semibold">{formatDistance(rulerDist)} <span className="font-normal text-white/60">straight line</span></span>
            ) : (
              <span>Tap two points or pins to measure</span>
            )}
            {rulerPts.length === 2 && !routeInfo && (
              <button onClick={routeByRoad} disabled={routing} className="font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-full px-2.5 py-1 transition">{routing ? '…' : 'Route by road'}</button>
            )}
            {rulerPts.length > 0 && <button onClick={clearRuler} className="font-semibold bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1 transition">Clear</button>}
            <button onClick={() => { setMode('idle'); clearRuler() }} aria-label="Done" className="text-white/70 hover:text-white p-1"><X size={14} /></button>
          </div>
          {routeInfo && (
            <span className="text-[10px] text-white/80 bg-slate-900/70 backdrop-blur-sm rounded-full px-2.5 py-0.5">Estimasi tanpa data lalu lintas — asumsi jalan lancar</span>
          )}
        </div>
      )}

      {form && (
        <MarkerForm
          marker={form.kind === 'edit' ? form.marker : undefined}
          initialLatLng={form.kind === 'create' ? form.latLng : null}
          onClose={() => setForm(null)}
          onSaved={m => {
            setMarkers(prev => (prev.find(x => x.id === m.id) ? prev.map(x => x.id === m.id ? m : x) : [...prev, m]))
            setForm(null)
          }}
        />
      )}
    </div>
  )
}
