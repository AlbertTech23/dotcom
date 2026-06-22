import Link from 'next/link'
import { QrScanner } from '@/components/QrScanner'
import { ChevronLeft } from 'lucide-react'

export default function ScanPage() {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm">
          <ChevronLeft size={16} />Back
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scan Member QR</h1>
      </div>

      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Point the camera at a member&apos;s QR code to instantly toggle their bus status.
      </p>

      <div id="onb-scanner" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <QrScanner />
      </div>
    </div>
  )
}
