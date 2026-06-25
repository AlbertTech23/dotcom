import { NextResponse } from 'next/server'
import type { ZodError, ZodType } from 'zod'
import { rateLimit, type LimiterName } from './ratelimit'

/** A plain `{ error }` JSON response with a status code. */
export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status })
}

/**
 * Log the real failure server-side and return a GENERIC message to the client.
 * Prevents leaking DB/constraint/internal details (L1). Use for any unexpected
 * error (failed DB write, thrown exception) — not for validation/auth, which have
 * their own intentional messages.
 */
export function serverError(context: string, detail: unknown) {
  console.error(`[${context}]`, detail)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 },
  )
}

/**
 * Rate-limit guard (mirrors requireAdmin): returns a 429 NextResponse when the
 * caller is over budget, or null to proceed. Key by authenticated user id.
 * No-ops (returns null) when Upstash isn't configured — see lib/ratelimit.
 */
export async function enforceLimit(name: LimiterName, key: string): Promise<NextResponse | null> {
  const r = await rateLimit(name, key)
  if (r.success) return null
  const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many requests — please slow down.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(r.limit),
        'X-RateLimit-Remaining': String(r.remaining),
      },
    },
  )
}

/** Read a JSON body without throwing — returns null on malformed/empty input. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

/** Turn a Zod failure into a friendly 400 naming the first offending field. */
export function zodFail(error: ZodError) {
  const first = error.issues[0]
  const where = first?.path.length ? `${first.path.join('.')}: ` : ''
  return fail(400, `${where}${first?.message ?? 'Invalid request'}`)
}

/**
 * Parse + validate a JSON request body against a schema.
 * Returns `{ data }` on success or `{ res }` (a ready-to-return 400) on failure.
 *
 *   const parsed = await parseBody(req, MySchema)
 *   if ('res' in parsed) return parsed.res
 *   const body = parsed.data
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { res: NextResponse }> {
  const result = schema.safeParse(await readJson(req))
  if (!result.success) return { res: zodFail(result.error) }
  return { data: result.data }
}
