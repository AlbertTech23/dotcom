'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle2, LogOut as LogOutIcon, AlertTriangle, ArrowRight, Camera } from 'lucide-react'

interface ScanResult {
  full_name: string
  action: 'out' | 'in'
  status: 'on_bus' | 'off_bus'
}

export function QrScanner() {
  const [result, setResult]         = useState<ScanResult | null>(null)
  const [error, setError]           = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [scanning, setScanning]     = useState(true)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-viewfinder')
      scannerRef.current = scanner as unknown as { stop: () => Promise<void> }

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          // Scale the scan box to ~70% of the (now responsive) viewfinder
          // instead of a fixed 200px, so it grows with the camera view.
          qrbox: (vw: number, vh: number) => {
            const size = Math.floor(Math.min(vw, vh) * 0.7)
            return { width: size, height: size }
          },
        },
        async (decodedText: string) => {
          setScanning(false)
          try {
            const res = await fetch('/api/admin/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ qr_token: decodedText }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Scan failed')
            setResult(data)
            if ('vibrate' in navigator) navigator.vibrate(200)
            setTimeout(() => { setResult(null); setScanning(true) }, 3000)
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            setTimeout(() => { setError(''); setScanning(true) }, 3000)
          }
        },
        () => { /* suppress per-frame decode errors */ },
      )

      setCameraActive(true)
    } catch {
      setError('Could not access camera. Please allow camera permission and try again.')
      setTimeout(() => setError(''), 4000)
    }
  }, [])

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div className="flex flex-col items-center gap-5">
      {/* ── Viewfinder square ── */}
      {scanning && (
        <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
          {/* Html5Qrcode mounts the <video> element here */}
          <div id="qr-viewfinder" className="w-full h-full" />

          {/* Start-camera overlay (shown before camera is granted) */}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 rounded-2xl">
              <div className="p-4 rounded-full bg-slate-800">
                <Camera size={36} className="text-slate-400" />
              </div>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
              >
                <Camera size={15} />
                Start Camera
              </button>
              <p className="text-xs text-slate-500 px-6 text-center">
                Browser will ask for camera permission
              </p>
            </div>
          )}

          {/* Corner-bracket + scan-line overlay (shown while camera is live) */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corners */}
              <span className="absolute top-4 left-4  w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
              <span className="absolute top-4 right-4  w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
              <span className="absolute bottom-4 left-4  w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
              <span className="absolute bottom-4 right-4  w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br" />
              {/* Scan line */}
              <div className="absolute left-6 right-6 top-1/2 h-px bg-emerald-400/60 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* ── Success overlay ── */}
      {result && (
        <div className="w-full rounded-2xl border border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 p-5 text-center space-y-2">
          <div className="flex justify-center">
            {result.action === 'out'
              ? <LogOutIcon size={48} className="text-red-500 dark:text-red-400" />
              : <CheckCircle2 size={48} className="text-emerald-500 dark:text-emerald-400" />
            }
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{result.full_name}</p>
          <p className={`flex items-center justify-center gap-1.5 text-base font-semibold ${
            result.status === 'off_bus' ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'
          }`}>
            <ArrowRight size={16} />
            {result.status === 'off_bus' ? 'LEFT the bus' : 'BACK on the bus'}
          </p>
        </div>
      )}

      {/* ── Error overlay ── */}
      {error && (
        <div className="w-full rounded-2xl border border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30 p-4 text-center space-y-1">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle size={16} />
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
