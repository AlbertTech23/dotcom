import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen px-4 py-6 pb-24 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 32 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
