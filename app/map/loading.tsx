import { Skeleton } from '@/components/Skeleton'

export default function Loading() {
  // The map fills the viewport; show a full-area placeholder.
  return (
    <div className="h-screen w-full p-3">
      <Skeleton className="h-full w-full rounded-2xl" />
    </div>
  )
}
