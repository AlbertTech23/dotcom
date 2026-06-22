import Link from 'next/link'
import { MemberForm } from '@/components/MemberForm'
import { ChevronLeft, UserPlus } from 'lucide-react'

export default function NewMemberPage() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition text-sm flex-shrink-0">
          <ChevronLeft size={16} />Back
        </Link>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        <UserPlus size={20} className="text-blue-500 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Add Member</h1>
          <p className="text-slate-500 text-xs mt-0.5">Create a new member account</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <MemberForm mode="create" />
      </div>
    </div>
  )
}
