import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
