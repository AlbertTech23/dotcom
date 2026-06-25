# DOTCOM — DOTA Companion

**DOTCOM** (short for *DOTA Companion*) is a mobile-first web app for the ACES DOTA REBOOT 2026 college trip. It started as a bus-attendance tracker and grew into the trip's companion: seating, rooms, groups, a live map, and committee map pins. Members get a personal QR code page; admins and committee run everything from a dashboard.

---

## Features

- **Admin dashboard** — live off-bus counter, searchable/filterable member table, exports (CSV/Excel), real-time updates via Supabase Realtime
- **QR scan** — admin opens camera, scans a member's QR code, status flips instantly with haptic feedback
- **Travel modes** — not everyone rides the bus: **Bus passenger** (default), **Setup Crew** (goes ahead to prep the villa), or **Convoy** (own vehicle). Setup Crew / Convoy are excluded from on/off-bus counts, scanning, and seating, but keep every other feature
- **Bus seating** — visual seat map for two buses; tap a seat to assign/move members; reclassify travel mode inline
- **Rooms & groups** — assign members to villa rooms and trip groups
- **Live map** — opt-in location sharing, plus committee-placed map pins (paste a Google Maps link) and driving directions
- **Member page** — each member sees their name, status/travel badge, personal QR code, location toggle, and committee contacts
- **Roles** — `admin`, `committee` (admin-level data access, can't assign roles), `member`
- **Bulk import** — POST a JSON array to `/api/admin/import` to create many members at once
- **Audit log** — every status change is recorded in `status_logs`
- **PWA-ready** — installable on Android/iOS via `manifest.json`
- **Hardened** — Zod-validated request bodies, rate limiting, login CAPTCHA, CSP headers, sanitized errors, PII isolated in `member_private` (see [Security](#security))

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth + DB | Supabase (Postgres + Auth + RLS + Realtime) |
| Styling | Tailwind CSS |
| QR display | qrcode.react |
| QR scan | html5-qrcode |
| Hosting | Vercel (recommended) |

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd aces-dota-reboot-2026
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL**, **Anon key**, and **Service role key** (Settings → API)

### 3. Run the schema

Open the Supabase **SQL Editor** and paste the contents of `supabase/schema.sql`, then run it.

This creates:
- `rooms`, `profiles` (linked to `auth.users`), `member_private` (PII), `groups`, `status_logs`, and `map_markers` tables
- `is_admin()` security-definer function (true for `admin` and `committee`)
- RLS policies for admin/committee and member access
- Realtime enabled on `profiles`, `rooms`, `groups`, and `map_markers`

### 4. Create your `.env.local`

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional features (app still runs without these)
ORS_API_KEY=your-openrouteservice-key          # map directions (/api/route)
ADMIN_VIEW_CODE=the-code-committee-type         # unlocks dashboard view for committee
UPSTASH_REDIS_REST_URL=https://...upstash.io    # API rate limiting (fails open if unset)
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key     # login CAPTCHA (skipped if unset)
```

> **CAPTCHA note:** the Turnstile **site** key goes here; the **secret** key goes in Supabase → Authentication → Attack Protection. Set both together (and the site key in Vercel) or logins will fail.

### 5. Create the first admin account

Option A — Supabase dashboard:
1. Go to **Authentication → Users → Add user**
2. Fill in email + password
3. In **Table Editor → profiles**, find that user's row and set `role = 'admin'`

Option B — SQL:
```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

### 6. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with your admin account and you'll land on the dashboard.

---

## Adding members

**Manual (one at a time):** Dashboard → + Member → fill the form.

**Bulk import:** Send a POST to `/api/admin/import` with a JSON body:

```json
{
  "members": [
    { "email": "john.doe@umn.ac.id", "password": "secret123", "full_name": "John Doe", "student_id": "00000012345", "group_label": "Bus A" },
    { "email": "jane.doe@umn.ac.id", "password": "secret456", "full_name": "Jane Doe", "student_id": "00000067890", "group_label": "Bus B", "travel_mode": "convoy" }
  ]
}
```

Response includes per-row success/failure so you can see which ones failed.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add the env vars in **Project Settings → Environment Variables** (the three required ones, plus any optional features you use — see the table below)
4. Deploy — Vercel auto-detects Next.js

> If you enable the login CAPTCHA, also set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` here **and redeploy before** turning CAPTCHA on in Supabase — otherwise the live app sends no token and every login fails.

For the PWA icons (`/public/icon-192.png` and `/public/icon-512.png`), add your own images before deploying so the install prompt works correctly.

---

## Project structure

```
app/
  api/
    admin/         Admin/committee routes — protected by requireAdmin():
      toggle/[id]/   flip member status      scan/          QR lookup + toggle
      reset-all/     reset to on_bus         members[/[id]] create / edit / delete / role
      import/        bulk create             seats/         assign / unassign seat
      rooms[/...]    room CRUD + assign      groups/        group create / reassign / rename / delete
      markers[/...]  map-pin CRUD            maps-resolve/  resolve a Google Maps link
    location/      member: update location / toggle sharing
    route/         member: driving directions (OpenRouteService)
  auth/            callback + password reset
  dashboard/       admin: overview, scan, member detail, add / import
  buses/           bus seat map
  rooms/ groups/   room & group views
  map/             live location map + pins
  login/  me/      login · member home (status, QR, location, contacts)
components/        DataTable, OffBusCounter, QrScanner, QrDisplay, MemberForm, MemberImport,
                   BusesView, BusMap, RoomsView, GroupsView, LiveMap, LocationToggle, StatusBadge,
                   ParticipantBadge, LiveStatusBadge, … (UI for the features above)
lib/
  supabase/        client.ts · server.ts (cookies) · admin.ts (service role) · with-private.ts (PII merge)
  schemas.ts       Zod request-body schemas (one per route)
  api.ts           parseBody / serverError / enforceLimit helpers
  ratelimit.ts     Upstash rate limiter        utils.ts  shared helpers (travel modes, etc.)
supabase/
  schema.sql       Full DB schema — run this first
```

---

## Environment variables reference

| Variable | Required | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Settings → API → service_role secret |
| `ORS_API_KEY` | optional | openrouteservice.org → dashboard (map directions) |
| `ADMIN_VIEW_CODE` | optional | you choose it (code committee type to unlock the dashboard) |
| `ADMIN_VIEW_SECRET` | optional | any random string; HMAC key for the admin_view cookie (falls back to the service role key) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | upstash.com → your Redis DB (API rate limiting) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional | Cloudflare → Turnstile → your widget (login CAPTCHA site key) |

> **Never commit `.env.local` to git.** The service role key bypasses all RLS — keep it server-side only.

---

## Security

This app went through a hardening pass. Notable measures, in case you extend it:

- **Input validation** — every API route validates its body with Zod (`lib/schemas.ts`) via `parseBody()`; unknown fields are stripped (no mass-assignment).
- **Rate limiting** — costly routes (`/api/route`, `/api/location`, `/api/admin/scan`) are per-user rate-limited via Upstash (`lib/ratelimit.ts`); fails open if Upstash isn't configured.
- **CAPTCHA** — login is protected by Cloudflare Turnstile when configured (site key + Supabase Auth secret).
- **Security headers** — CSP (report-only), HSTS, X-Frame-Options, etc. in `next.config.ts`. Add new external origins to the CSP allowlist.
- **Sanitized errors** — routes never leak raw DB errors; `serverError()` logs server-side and returns a generic message.
- **PII isolation** — `student_id` / `phone` / `qr_token` live in `member_private` (own-row/admin RLS), not in the broadly-readable `profiles`.
- **Dependencies** — `xlsx` is pinned to the patched SheetJS CDN build (do **not** `npm install xlsx`); a CI workflow runs `npm audit` and Dependabot watches for advisories.
