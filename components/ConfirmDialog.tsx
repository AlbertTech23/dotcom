'use client'
import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * App-wide confirmation modal — one consistent look for every destructive or
 * irreversible action (delete member / room / group, …), replacing the native
 * window.confirm(). Bottom-sheet on mobile, centered on desktop, matching the
 * seat-detail and QR modals (z above both at z-[1300]).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmCls = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-blue-600 hover:bg-blue-500 text-white'
  const iconCls = tone === 'danger'
    ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40'
    : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40'

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconCls}`}>
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            {message && <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</div>}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 transition"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 py-2 rounded-lg transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50 ${confirmCls}`}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
