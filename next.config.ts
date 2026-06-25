import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// ── Security headers (H1) ───────────────────────────────────────────────────
// The "static" set below is safe to enforce immediately — it can't break the app.
// CSP is shipped as Content-Security-Policy-Report-Only first, because this app
// uses the camera (html5-qrcode), Leaflet tiles, framer-motion inline styles and
// Supabase realtime — all of which need to be validated against the policy before
// it's enforced. Once the browser console / report endpoint is clean, rename the
// key to 'Content-Security-Policy' to enforce it.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openrouteservice.org https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
  // HSTS only in production — never send it from localhost/dev over http.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
