'use client'

/**
 * Client wrapper for the delete-member form so we can attach a confirm() guard
 * (event handlers can't live in a Server Component). The server action is passed
 * down as a prop.
 */
export function DeleteMemberButton({
  action,
  name,
}: {
  action: (formData: FormData) => void | Promise<void>
  name: string
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        onClick={e => { if (!confirm(`Delete ${name}? This cannot be undone.`)) e.preventDefault() }}
        className="w-full border border-red-300 dark:border-red-800 hover:border-red-500 dark:hover:border-red-600 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium py-2.5 rounded-xl transition"
      >
        Delete Member
      </button>
    </form>
  )
}
