import Link from 'next/link'
import { Bus, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6 text-center">
      {/* Big 404 */}
      <div className="relative select-none">
        <p className="text-[8rem] font-black text-slate-100 dark:text-slate-800 leading-none tracking-tighter">
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <Bus size={48} className="text-emerald-500" />
        </div>
      </div>

      <div className="space-y-1.5 -mt-2">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          This stop doesn&apos;t exist
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          The page you&apos;re looking for isn&apos;t on the route. Maybe the URL is wrong, or it was removed.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition"
      >
        <Home size={15} />
        Back to Home
      </Link>
    </div>
  )
}
