import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 pb-28 gap-6 max-w-sm mx-auto w-full">
      <div className="flex flex-col items-center gap-2 mt-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-24 rounded-full mt-1" />
      </div>
      <Skeleton className="h-56 w-56 rounded-2xl" />
      <Skeleton className="h-12 w-64 rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
