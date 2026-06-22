'use client'
import { useState } from 'react'
import { QrDisplay } from '@/components/QrDisplay'
import { QrCode, X } from 'lucide-react'

/**
 * Dashboard affordance for committee members (who are trip participants and need
 * to be scanned, but whose bottom-nav center action is "Scan", not "My QR").
 * Renders a button that opens their personal QR in a modal.
 */
export function MyQrButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full sm:w-auto justify-center border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
      >
        <QrCode size={16} />
        Show my QR
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[1200] flex flex-col items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-sm px-6"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-2xl"
          >
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Show this to the committee</p>
            <QrDisplay token={token} />
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              <X size={15} />Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
