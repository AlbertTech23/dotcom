import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TourButton } from '@/components/TourButton'
import { NavLocationToggle } from '@/components/NavLocationToggle'
import { Logo } from '@/components/Logo'
import type { Profile } from '@/types/database'
import { UserPlus, LogOut, UserCircle } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, location_sharing')
    .eq('id', user.id)
    .single()
  const profile = profileData as Pick<Profile, 'role' | 'location_sharing'> | null
  const isCommittee = profile?.role === 'committee'

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Slim top bar — primary navigation lives in the bottom nav; this row keeps
          only the brand and utility actions. */}
      <nav className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-2 sticky top-0 z-20">
        <Link href="/dashboard" className="flex items-center mr-auto">
          <Logo size="bar" />
        </Link>

        {isCommittee && (
          <Link href="/me"
            className="flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition">
            <UserCircle size={13} />
            <span className="hidden sm:inline">Member View</span>
          </Link>
        )}
        <Link href="/dashboard/members/new" id="onb-add-member" title="Add member"
          className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition">
          <UserPlus size={15} />
        </Link>
        <NavLocationToggle initialSharing={profile?.location_sharing ?? false} />
        <TourButton tourId="admin" />
        <ThemeToggle />
        <form action={signOut}>
          <button type="submit" className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs transition p-1">
            <LogOut size={14} />
          </button>
        </form>
      </nav>

      {/* Page content — pb leaves room for the fixed bottom nav */}
      <main className="flex-1 px-4 py-6 pb-24 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
