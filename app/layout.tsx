import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { OnbordaProvider, Onborda } from 'onborda'
import { TourCard } from '@/components/TourCard'
import { OnboardingController } from '@/components/OnboardingController'
import { NavigationProgress } from '@/components/NavigationProgress'
import { FooterNav } from '@/components/FooterNav'
import { TopNav } from '@/components/TopNav'
import { AppToaster } from '@/components/AppToaster'
import { tours } from '@/lib/tours'

export const metadata: Metadata = {
  title: 'DOTCOM',
  description: 'DOTCOM — DOTA Companion app for ACES DOTA REBOOT 2026',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen text-slate-900 dark:text-slate-100 antialiased">
        <ThemeProvider>
          <AppToaster />
          <OnbordaProvider>
            <Onborda
              steps={tours}
              showOnborda={true}
              shadowRgb="15,23,42"
              shadowOpacity="0.6"
              cardComponent={TourCard}
              cardTransition={{ duration: 0.3, type: 'tween' }}
            >
              <NavigationProgress />
              <OnboardingController />
              <TopNav />
              {children}
              <FooterNav />
            </Onborda>
          </OnbordaProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
