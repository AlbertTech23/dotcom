'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'

const PING_INTERVAL_MS = 30_000
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
}

export function NavLocationToggle({ initialSharing, floating = false }: { initialSharing: boolean; floating?: boolean }) {
  const [sharing, setSharing]   = useState(initialSharing)
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState<'idle' | 'ok' | 'denied'>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        })
        setStatus('ok')
      },
      err => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'idle'),
      GEO_OPTIONS,
    )
  }, [])

  const startPinging = useCallback(() => {
    if (intervalRef.current) return
    sendLocation()
    intervalRef.current = setInterval(sendLocation, PING_INTERVAL_MS)
  }, [sendLocation])

  const stopPinging = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  useEffect(() => {
    if (!sharing) { stopPinging(); return }
    if (!document.hidden) startPinging()
    const onVisibility = () => document.hidden ? stopPinging() : startPinging()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stopPinging(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [sharing, startPinging, stopPinging])

  async function toggle() {
    setLoading(true)
    const next = !sharing
    const res = await fetch('/api/location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharing: next }),
    })
    if (res.ok) {
      setSharing(next)
      if (!next) setStatus('idle')
      // Sync every other sharing control + the map count in this tab instantly,
      // without depending on realtime delivery.
      window.dispatchEvent(new CustomEvent('dotcom:location-sharing', { detail: next }))
    }
    setLoading(false)
  }

  // Reflect a toggle made by any other control (navbar, map header, /me) in the
  // same tab. The navbar instance lives in the root layout, so this keeps it in
  // sync even after navigating between pages.
  useEffect(() => {
    function onSync(e: Event) {
      const next = (e as CustomEvent<boolean>).detail
      setSharing(next)
      if (!next) setStatus('idle')
    }
    window.addEventListener('dotcom:location-sharing', onSync)
    return () => window.removeEventListener('dotcom:location-sharing', onSync)
  }, [])

  const label = status === 'denied' ? 'Denied'
    : status === 'ok' && sharing   ? 'Sharing'
    : sharing                       ? 'Starting…'
    : 'Location'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={sharing ? 'Stop sharing location' : 'Share my location'}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${floating ? 'shadow-md backdrop-blur' : ''} ${
        sharing
          ? `border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 ${floating ? 'bg-emerald-50/95 dark:bg-emerald-900/80' : 'bg-emerald-50 dark:bg-emerald-900/30'}`
          : floating
            ? 'bg-white/95 dark:bg-slate-800/95 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
            : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-400 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Navigation
        size={13}
        className={sharing ? 'text-emerald-500' : 'text-slate-400'}
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
