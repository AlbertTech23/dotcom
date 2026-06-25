# CLAUDE.md — DOTCOM (DOTA Companion · ACES DOTA REBOOT 2026)

Context for AI assistants working on this codebase.

## What this app does

Mobile-first companion app for a UMN college trip. Beyond bus attendance it covers
bus seating, rooms, groups, a live location map, and committee-placed map pins. Roles:
- **Admin** — full access: roster, on/off-bus toggle + QR scan, seats, rooms, groups, map pins, role assignment
- **Committee** — same data access as admin (cannot assign roles); also has their own trip data
- **Member** — log in, see own status and personal QR code, share location, browse seats/rooms/groups/map

Not everyone rides the bus — see **travel modes** below.

## Stack

- **Next.js 15 App Router** — all routing is file-based under `app/`
- **Supabase** — Postgres database, Auth (email/password), RLS, Realtime
- **@supabase/ssr** — server-side auth via cookies; use `createClient()` from `lib/supabase/server.ts` in Server Components and Route Handlers
- **Tailwind CSS** — utility-first, mobile-first breakpoints (`sm:`, `md:`, `lg:`)

## Auth and roles

- Roles are stored in `public.profiles.role` (`'admin'` | `'committee'` | `'member'`). `committee` has the same data access as `admin` (see `is_admin()`); the only thing `committee` can't do is assign roles (`requireSuperAdmin` gates that)
- `is_admin()` is a SECURITY DEFINER SQL function — use it in RLS policies to avoid recursion
- `lib/supabase/admin.ts` uses the service role key — **never import this in Client Components or expose it to the browser**
- Middleware (`middleware.ts`) handles route protection:
  - Unauthenticated → `/login`
  - Member hitting `/dashboard/*` → `/me`
  - Admin hitting `/me` → `/dashboard`

## Key conventions

- **Server Components** fetch data directly with `createClient()` from `lib/supabase/server.ts`
- **Client Components** use `createClient()` from `lib/supabase/client.ts`
- **API Route Handlers** use `lib/supabase/server.ts` for auth checks and `lib/supabase/admin.ts` for privileged operations (creating/deleting auth users)
- **Status model**: `on_bus` (default) / `off_bus`. Every toggle writes a row to `status_logs`
- **Travel modes**: `profiles.travel_mode` is `bus` (default) / `advance` (Setup Crew) / `convoy` (own vehicle). Only `bus` travelers are tracked on/off the bus — they're the only ones counted by `OffBusCounter`, scannable (`/api/admin/scan`), toggleable, and seatable. `advance`/`convoy` keep every other feature (location, rooms, groups, map). Gate this with `isBusTraveler()` from `lib/utils.ts`; render the right pill with `ParticipantBadge`. Switching someone off `bus` vacates their seat
- **QR tokens**: `qr_token` is a UUID in `member_private` (NOT `profiles`). The scanner POSTs this token to `/api/admin/scan` which does the lookup and toggle
- **PII split**: `student_id`, `phone`, `qr_token` live in `member_private` (own-row/admin RLS), kept out of the broadly-readable `profiles`. Merge them into profile rows with `mergePrivate()` from `lib/supabase/with-private.ts`
- **Realtime**: `DashboardClient` (dashboard) and `BusesView` (seat map) subscribe to `postgres_changes` on `profiles`; UIs also update optimistically so they don't depend on realtime landing

## Database schema

See `supabase/schema.sql` for the full schema. Key tables:

```
rooms          id, name, floor, notes, capacity, created_at
               (must be created BEFORE profiles because profiles FK into it)

profiles       id (FK auth.users), full_name, role, photo_url, group_label,
               status, travel_mode, bus_number, seat_number, room_id (FK rooms.id),
               latitude, longitude, location_sharing, location_updated_at,
               last_changed_at, created_at
               (NO PII here — see member_private)

member_private id (FK profiles), student_id, phone, qr_token (unique UUID)
               (own-row/admin RLS; PII + the scan credential live here, not in profiles)

groups         id, name (unique), created_at
               (registry so empty groups persist; membership is profiles.group_label text)

status_logs    id, member_id, action ('out'|'in'), changed_by, created_at

map_markers    id, label, icon, latitude, longitude, visibility ('public'|'private'),
               source_url, created_by, created_at
```

RLS highlights:
- `admin_select_all` — admins see all profiles
- `member_select_own` — members see their own row
- `member_see_admins` — members can see admin profiles (for contact button)
- `member_select_sharing` — members see rows where `location_sharing = true`
- `all_select_rooms` — all authenticated users can read rooms; only admin can write

## API routes

Everything under `app/api/admin/` is protected by `requireAdmin()` (admin **or** committee).
`/api/location` and `/api/route` are member-accessible (auth only). Role assignment is
additionally gated by `requireSuperAdmin()` (true admin only).

| Route | Method | What it does |
|---|---|---|
| `/api/admin/toggle/[id]` | POST | Flip member status + write log (bus travelers only) |
| `/api/admin/scan` | POST | Lookup by `qr_token`, flip status + write log (rate-limited; bus travelers only) |
| `/api/admin/reset-all` | POST | Set all bus travelers to `on_bus` |
| `/api/admin/members` | POST | Create auth user + profile (service role) |
| `/api/admin/members/[id]` | PATCH / DELETE | Edit profile / delete auth user |
| `/api/admin/members/[id]/role` | PATCH | Assign role (super-admin only) |
| `/api/admin/import` | POST | Bulk create members from JSON array |
| `/api/admin/seats` | POST / DELETE | Assign / unassign bus seat |
| `/api/admin/rooms` | GET / POST | List rooms / create room |
| `/api/admin/rooms/[id]` | PATCH / DELETE | Edit / delete room |
| `/api/admin/rooms/assign` | POST | Assign member to room (`roomId: null` to unassign) |
| `/api/admin/groups` | POST / PATCH / PUT / DELETE | Create / reassign member / rename / delete group |
| `/api/admin/markers` | POST | Create a map pin |
| `/api/admin/markers/[id]` | PATCH / DELETE | Edit / delete a map pin |
| `/api/admin/maps-resolve` | POST | Resolve a pasted Google Maps link to lat/lng (SSRF-guarded) |
| `/api/location` | POST / PATCH | Update own location / toggle sharing (rate-limited) |
| `/api/route` | POST | Driving directions via OpenRouteService (rate-limited) |

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL        — public, safe for browser
NEXT_PUBLIC_SUPABASE_ANON_KEY   — public, safe for browser
SUPABASE_SERVICE_ROLE_KEY       — secret, server-only (bypasses RLS)
ORS_API_KEY                     — secret, server-only (OpenRouteService, used by /api/route)
ADMIN_VIEW_CODE                 — secret, the code committee enter to unlock the dashboard view
ADMIN_VIEW_SECRET               — optional; HMAC key for the admin_view cookie (falls back to SERVICE_ROLE_KEY)
UPSTASH_REDIS_REST_URL          — rate limiting; if unset, limiter fails open (allows all)
UPSTASH_REDIS_REST_TOKEN        — rate limiting
NEXT_PUBLIC_TURNSTILE_SITE_KEY  — public; login CAPTCHA. If unset, CAPTCHA is skipped
```

> The Turnstile **secret** key is NOT an app env var — it's pasted into Supabase → Auth → Attack Protection. Enable Supabase CAPTCHA and set this site key together, or logins break.

## Security conventions (hardening pass — keep these intact)

- **Validate every request body with Zod.** Schemas live in `lib/schemas.ts`; parse via `parseBody(req, schema)` from `lib/api.ts` (returns `{ data }` or `{ res }`). This also strips unknown keys → prevents mass-assignment (e.g. a member can't smuggle `role`/`status`).
- **Never return raw DB errors.** Use `serverError(context, err)` from `lib/api.ts` for unexpected failures — it logs server-side and returns a generic message. Don't `return NextResponse.json({ error: err.message })`.
- **Rate-limit costly routes** with `enforceLimit(name, userId)` from `lib/api.ts` (Upstash-backed, `lib/ratelimit.ts`). Currently on `/api/route`, `/api/location`, `/api/admin/scan`.
- **`admin_view` cookie is HMAC-signed** (`lib/admin-view.ts`) — never revert it to a plain `'1'` value; middleware verifies the signature.
- **`xlsx` is pinned to the SheetJS CDN tarball** in `package.json` (the npm registry version has unpatched CVEs). Do NOT `npm install xlsx` to "fix" it — that reintroduces the vulnerable package. Dependabot ignores it.
- **Security headers + CSP** are in `next.config.ts` (CSP is currently `Report-Only`). When you add an external script/style/connect/frame origin, add it to the CSP allowlist too.
- **Role assignment is admin-only** via `requireSuperAdmin` — `'admin'` can never be granted through the API (only `member`/`committee`).

## Things to be careful about

- **Never use relative URLs in Server Actions** — `fetch('/api/...')` doesn't resolve in a server context. Call Supabase directly or use `createAdminClient()` instead
- **`params` is a Promise in Next.js 15** — always `await params` before destructuring in Route Handlers and page components
- **RLS**: members can read only their own profile row; admins can read/write all. The `status` field is not updatable by members (enforced by RLS — only admin policies allow update)
- **html5-qrcode** must be dynamically imported (it uses browser APIs) — the `QrScanner` component already does this
- **Service role key bypasses RLS** — only use `createAdminClient()` for operations that legitimately need it (creating/deleting auth users, seeding)
