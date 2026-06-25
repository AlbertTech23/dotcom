import type { Status, TravelMode } from '@/types/database'
import { StatusBadge } from './StatusBadge'

const MODE_STYLES: Record<'advance' | 'convoy', { label: string; cls: string; dot: string }> = {
  advance: {
    label: 'Setup Crew',
    cls: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700',
    dot: 'bg-violet-500 dark:bg-violet-400',
  },
  convoy: {
    label: 'Convoy',
    cls: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
}

/** Pill for a non-bus traveler (Setup Crew / Convoy). */
export function TravelBadge({ mode }: { mode: 'advance' | 'convoy' }) {
  const s = MODE_STYLES[mode]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
      {s.label}
    </span>
  )
}

/** Shows the right pill for a participant: on/off-bus for bus travelers, or their
 *  travel mode (Setup Crew / Convoy) for those who don't ride the bus. */
export function ParticipantBadge({ status, travel_mode }: { status: Status; travel_mode: TravelMode }) {
  if (travel_mode === 'advance' || travel_mode === 'convoy') return <TravelBadge mode={travel_mode} />
  return <StatusBadge status={status} />
}
