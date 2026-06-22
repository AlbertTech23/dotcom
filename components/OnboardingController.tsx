'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useOnborda } from 'onborda'
import { createClient } from '@/lib/supabase/client'

export function OnboardingController() {
  const { startOnborda } = useOnborda()
  const pathname = usePathname()

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, has_seen_onboarding')
        .eq('id', user.id)
        .single()

      if (!profile || profile.has_seen_onboarding) return

      const isPrivileged = profile.role === 'admin' || profile.role === 'committee'

      // Only start tour when the user is on the relevant landing page.
      // Starting it on other pages (e.g. /map) would leave the Onborda overlay
      // covering the whole screen and blocking interactions.
      const onAdminLanding  = isPrivileged && pathname === '/dashboard'
      const onMemberLanding = !isPrivileged && pathname === '/me'
      if (!onAdminLanding && !onMemberLanding) return

      setTimeout(() => {
        startOnborda(isPrivileged ? 'admin' : 'member')
      }, 800)
    }

    check()
  }, [startOnborda, pathname])

  return null
}
