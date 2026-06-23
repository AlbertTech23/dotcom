import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    // Let the password-reset page through even with a (recovery) session — the
    // user needs to be signed in via the recovery link to set a new password.
    if (user && !pathname.startsWith('/auth/reset')) {
      // Redirect logged-in users away from login
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const dest = profile?.role === 'member' ? '/me' : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return response
  }

  // Protected routes — must be logged in
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'
  const isPrivileged = role === 'admin' || role === 'committee'
  // Committee default to the personal view; the dashboard is unlocked per-session
  // via the admin-view code (sets this cookie). Read it directly here — next/headers
  // cookies() isn't available in middleware.
  const adminView = request.cookies.get('admin_view')?.value === '1'

  // Shared routes — accessible to all authenticated users
  if (
    pathname.startsWith('/buses') ||
    pathname.startsWith('/map') ||
    pathname.startsWith('/groups') ||
    pathname.startsWith('/rooms')
  ) return response

  // /me: accessible to members and committee (who want to see their personal data)
  // pure admins (superadmin) have no personal data — redirect them to dashboard
  if (pathname === '/me' && role === 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // /dashboard: pure admins always; committee only after unlocking admin view;
  // everyone else goes to their personal page.
  if (pathname.startsWith('/dashboard') && !(role === 'admin' || (role === 'committee' && adminView))) {
    return NextResponse.redirect(new URL('/me', request.url))
  }

  return response
}

export const config = {
  // Exclude framework assets AND the PWA files (sw.js, manifest.json) and icons —
  // these must be publicly fetchable, otherwise auth middleware redirects them to
  // /login (307) and the service worker / manifest fail to load.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
