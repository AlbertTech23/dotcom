import Link from 'next/link'
import { QrScanner } from '@/components/QrScanner'
import { ChevronLeft, ScanLine } from 'lucide-react'

export default function ScanPage() {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </Link>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <ScanLine size={20} className="text-blue-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scan Member QR</h1>
          <p className="text-slate-500 text-xs mt-0.5">Point the camera at a member&apos;s QR to toggle bus status</p>
        </div>
      </div>

      <div id="onb-scanner" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <QrScanner />
      </div>
    </div>
  )
}
