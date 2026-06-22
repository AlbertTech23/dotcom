// DOTCOM brand mark — concept E2: the "O" of DOT is a map pin, "COM" rides in a
// blue URL-style pill. Self-contained inline SVG; no external assets.

/** The bare map-pin glyph that stands in for the "O". */
function Pin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
        className="fill-blue-600 dark:fill-blue-500"
      />
      <circle cx="12" cy="9" r="2.6" className="fill-white dark:fill-slate-900" />
    </svg>
  )
}

/**
 * The DOTCOM wordmark.
 * - `size="bar"` for top navigation, `size="hero"` for the login screen.
 * - `tagline` shows the "DOTA COMPANION" expansion underneath.
 */
export function Logo({
  size = 'bar',
  tagline = false,
}: {
  size?: 'bar' | 'hero'
  tagline?: boolean
}) {
  const main = size === 'hero' ? 'text-4xl' : 'text-lg'
  const pill = size === 'hero' ? 'rounded-lg px-1.5 ml-1' : 'rounded-md px-1 ml-0.5'
  const sub = size === 'hero' ? 'text-xs mt-1.5' : 'text-[9px] mt-0.5'

  return (
    <span className="inline-flex flex-col leading-none select-none">
      <span className={`inline-flex items-center font-extrabold tracking-tight text-slate-900 dark:text-white ${main}`}>
        D
        <Pin className="h-[0.82em] w-auto translate-y-[0.04em]" />
        T
        <span className={`bg-blue-600 text-white ${pill}`}>COM</span>
      </span>
      {tagline && (
        <span className={`font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400 ${sub}`}>
          DOTA COMPANION
        </span>
      )}
    </span>
  )
}

/**
 * Standalone pin mark for icon slots.
 * - `variant="tile"` renders a white pin on a rounded blue tile (app-icon style).
 * - `variant="plain"` renders just the blue pin.
 */
export function LogoMark({
  size = 24,
  variant = 'plain',
}: {
  size?: number
  variant?: 'plain' | 'tile'
}) {
  if (variant === 'tile') {
    return (
      <span
        style={{ width: size, height: size }}
        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm"
      >
        <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} aria-hidden="true">
          <path
            d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
            className="fill-white"
          />
          <circle cx="12" cy="9" r="2.6" className="fill-blue-600" />
        </svg>
      </span>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
        className="fill-blue-600 dark:fill-blue-500"
      />
      <circle cx="12" cy="9" r="2.6" className="fill-white dark:fill-slate-900" />
    </svg>
  )
}
