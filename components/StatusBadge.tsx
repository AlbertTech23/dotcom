import type { Status } from '@/types/database'

export function StatusBadge({ status }: { status: Status }) {
  return status === 'on_bus' ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
      On Bus
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 inline-block animate-pulse" />
      Off Bus
    </span>
  )
}
