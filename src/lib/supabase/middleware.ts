import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes
  const publicRoutes = ['/login', '/signup', '/api/stripe/webhook']
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Get role from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, waiver_accepted, status')
      .eq('id', user.id)
      .single()

    // Waiver gate — students must accept before going anywhere
    if (
      profile &&
      profile.role === 'student' &&
      !profile.waiver_accepted &&
      !pathname.startsWith('/waiver') &&
      !isPublic
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/waiver'
      return NextResponse.redirect(url)
    }

    // Admin trying to access student routes — redirect to admin dashboard
    if (profile?.role === 'admin' && pathname.startsWith('/student')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Student trying to access admin routes — redirect to student dashboard
    if (
      profile?.role === 'student' &&
      !pathname.startsWith('/student') &&
      !pathname.startsWith('/waiver') &&
      !isPublic
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/student/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirect root to correct dashboard
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname =
        profile?.role === 'admin' ? '/dashboard' : '/student/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
