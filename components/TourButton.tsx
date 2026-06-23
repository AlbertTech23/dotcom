'use client'
import { useOnborda } from 'onborda'
import { useRouter, usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'

interface TourButtonProps {
  tourId: 'admin' | 'member'
  className?: string
}

export function TourButton({ tourId, className = '' }: TourButtonProps) {
  const { startOnborda } = useOnborda()
  const router = useRouter()
  const pathname = usePathname()
  // The tour's first step anchors to the home page's header, so when replayed
  // from elsewhere we route home first (OnboardingController reads ?tour= and starts).
  const home = tourId === 'admin' ? '/dashboard' : '/me'

  function start() {
    if (pathname === home) startOnborda(tourId)
    else router.push(`${home}?tour=${tourId}`)
  }

  return (
    <button
      onClick={start}
      title="Replay tour"
      className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${className}`}
    >
      <HelpCircle size={15} />
    </button>
  )
}
