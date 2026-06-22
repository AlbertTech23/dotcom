'use client'
import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

// App-wide toast host. Matches the active theme (next-themes uses class-based dark
// mode, so we pass the resolved theme rather than relying on prefers-color-scheme).
export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-center"
      richColors
      closeButton
    />
  )
}
