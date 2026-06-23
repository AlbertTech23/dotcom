'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useOnborda } from 'onborda'

// Device-locked onboarding: the "seen" flag lives in localStorage (per browser),
// NOT per user. A shared admin account should still show the tour once on each
// new device, so every operator gets the same walkthrough. Landing pages are
// role-specific (/dashboard = staff, /me = member), so we pick the tour by path
// and need no server role lookup.
export function OnboardingController() {
  const { startOnborda, isOnbordaVisible } = useOnborda()
  const pathname = usePathname()

  useEffect(() => {
    const tour = pathname === '/dashboard' ? 'admin' : pathname === '/me' ? 'member' : null
    if (!tour) return

    // Explicit replay: the ? button on another page routes here with ?tour=… —
    // honour it even if the tour was seen before, then strip the param.
    const forced = new URLSearchParams(window.location.search).get('tour') === tour
    if (forced) window.history.replaceState(null, '', window.location.pathname)

    // A tour's final step routes back to its landing page. If one is already
    // running, don't auto-start again — that would reset it to step 1.
    if (isOnbordaVisible) return
    // Auto-start only once per device, but a forced replay bypasses the flag.
    if (!forced && localStorage.getItem(`dotcom-tour-seen:${tour}`)) return

    // Delay so the page settles before the first step anchors.
    const timer = setTimeout(() => startOnborda(tour), forced ? 500 : 800)
    return () => clearTimeout(timer)
  }, [startOnborda, isOnbordaVisible, pathname])

  return null
}
