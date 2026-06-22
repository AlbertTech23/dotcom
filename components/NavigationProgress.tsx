'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin top-of-screen progress bar that reflects *actual* client-side navigation:
 * it starts when a navigation begins (internal link click or back/forward),
 * trickles forward while the new route's RSC payload + data are fetched, and
 * completes the instant the route commits (pathname change). No external dep.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)

  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
    if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null }
  }, [])

  const done = useCallback(() => {
    clearTimers()
    setWidth(100)
    hideRef.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 250)
  }, [clearTimers])

  const start = useCallback(() => {
    clearTimers()
    setVisible(true)
    setWidth(8)
    // Trickle toward 90% and slow down as it approaches — never reaches 100 until
    // the route actually commits (done()).
    trickleRef.current = setInterval(() => {
      setWidth(w => {
        if (w >= 90) return w
        const inc = w < 50 ? 9 : w < 75 ? 4 : 1.5
        return Math.min(90, w + inc)
      })
    }, 180)
    // Safety net: if navigation never commits (e.g. a link that doesn't actually
    // change the route), don't leave the bar hanging.
    safetyRef.current = setTimeout(done, 10000)
  }, [clearTimers, done])

  // Complete when the route commits.
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      done()
    }
  }, [pathname, done])

  // Start on internal link clicks.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Ignore modified clicks / non-primary buttons (new tab, etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return
      let url: URL
      try { url = new URL(href, location.href) } catch { return }
      // Only internal navigations that actually change the path.
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname) return
      start()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [start])

  // Start on browser back/forward.
  useEffect(() => {
    window.addEventListener('popstate', start)
    return () => window.removeEventListener('popstate', start)
  }, [start])

  // Clean up on unmount.
  useEffect(() => clearTimers, [clearTimers])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 h-[2px] bg-emerald-500 z-[9999] pointer-events-none transition-[width] duration-200 ease-out"
      style={{ width: `${width}%`, boxShadow: '0 0 8px rgba(16,185,129,0.7)' }}
    />
  )
}
