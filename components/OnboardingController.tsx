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
  const { startOnborda } = useOnborda()
  const pathname = usePathname()

  useEffect(() => {
    const tour = pathname === '/dashboard' ? 'admin' : pathname === '/me' ? 'member' : null
    if (!tour) return
    if (localStorage.getItem(`dotcom-tour-seen:${tour}`)) return

    // Only auto-start on the relevant landing page; delay so the page settles.
    const timer = setTimeout(() => startOnborda(tour), 800)
    return () => clearTimeout(timer)
  }, [startOnborda, pathname])

  return null
}
