'use client'
import { useOnborda } from 'onborda'
import { HelpCircle } from 'lucide-react'

interface TourButtonProps {
  tourId: 'admin' | 'member'
  className?: string
}

export function TourButton({ tourId, className = '' }: TourButtonProps) {
  const { startOnborda } = useOnborda()

  return (
    <button
      onClick={() => startOnborda(tourId)}
      title="Replay tour"
      className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${className}`}
    >
      <HelpCircle size={15} />
    </button>
  )
}
