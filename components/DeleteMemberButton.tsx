'use client'

import { useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Client wrapper for the delete-member form. The destructive confirm now uses the
 * shared <ConfirmDialog> (uniform across the app) instead of native confirm(); on
 * confirm we submit the hidden form so the server action still runs.
 */
export function DeleteMemberButton({
  action,
  name,
}: {
  action: (formData: FormData) => void | Promise<void>
  name: string
}) {
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      <form ref={formRef} action={action}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border border-red-300 dark:border-red-800 hover:border-red-500 dark:hover:border-red-600 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium py-2.5 rounded-xl transition"
        >
          Delete Member
        </button>
      </form>

      <ConfirmDialog
        open={open}
        title="Delete member?"
        message={<>This permanently deletes <strong className="text-slate-700 dark:text-slate-200">{name}</strong> and their account. This cannot be undone.</>}
        confirmLabel="Delete"
        onConfirm={() => { setOpen(false); formRef.current?.requestSubmit() }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
