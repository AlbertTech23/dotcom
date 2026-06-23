'use client'
import type { CardComponentProps } from 'onborda'
import { useOnborda } from 'onborda'
import { useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda, currentTour } = useOnborda()
  const cardRef = useRef<HTMLDivElement>(null)

  // Onborda positions the card relative to the highlighted element (e.g. it
  // centers a `side: 'bottom'` card on the element) and does NOT clamp it to the
  // viewport. So a target near a screen edge — the map header at top-left, or the
  // export button — pushes the card off-screen. After the card settles, measure it
  // and nudge it back inside the viewport.
  //
  // Worse: Onborda derives the card position from the target's *document-flow*
  // coordinates. For a target inside a `position: sticky` bar (the dashboard top
  // bar / desktop header) or a `position: fixed` bar (the mobile bottom nav), the
  // visual position diverges from the flow position once the page is scrolled —
  // stranding the card mid-screen while the highlight stays pinned to the bar. For
  // those pinned targets we re-anchor the card to the element's *visual* rect.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    // Walk up from the target — stickiness/fixedness usually lives on an ancestor
    // bar, not the highlighted link itself.
    const isPinned = (node: Element | null) => {
      let n: Element | null = node
      while (n && n !== document.body) {
        const p = getComputedStyle(n).position
        if (p === 'fixed' || p === 'sticky') return true
        n = n.parentElement
      }
      return false
    }

    const clamp = () => {
      el.style.transform = 'translate(0px, 0px)'
      const rect = el.getBoundingClientRect()
      const m = 8 // min gap from the viewport edge
      let dx = 0
      let dy = 0

      // Re-anchor to a pinned target's visual rect before clamping.
      const target = step?.selector ? document.querySelector(step.selector) : null
      if (target && isPinned(target)) {
        const t = target.getBoundingClientRect()
        const gap = 12
        dx = (t.left + t.width / 2 - rect.width / 2) - rect.left // centre on target
        const above = (t.top - gap - rect.height) - rect.top
        const below = (t.bottom + gap) - rect.top
        // Honour the requested side, but flip if there isn't room (e.g. the desktop
        // header puts a `side: 'top'` target flush against the viewport top).
        if (step?.side === 'top') dy = rect.top + above < m ? below : above
        else dy = rect.bottom + below > window.innerHeight - m ? above : below
      }

      // Clamp the re-anchored box back inside the viewport.
      const left = rect.left + dx
      const right = rect.right + dx
      const top = rect.top + dy
      const bottom = rect.bottom + dy
      if (left < m) dx += m - left
      else if (right > window.innerWidth - m) dx += window.innerWidth - m - right
      if (top < m) dy += m - top
      else if (bottom > window.innerHeight - m) dy += window.innerHeight - m - bottom

      if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`
    }

    // Clamp immediately, then again as Onborda's card/pointer transition (~300ms)
    // and the smooth scrollIntoView settle — the element's final rect isn't known
    // until both finish, and either can leave the card off-screen.
    const raf = requestAnimationFrame(clamp)
    const timers = [120, 360, 700].map(ms => setTimeout(clamp, ms))
    window.addEventListener('resize', clamp)
    window.addEventListener('scroll', clamp, true) // capture: catch scroll on any container
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', clamp)
      window.removeEventListener('scroll', clamp, true)
    }
  }, [currentStep, step])

  // Mark this device as having seen the current tour (localStorage, per browser),
  // then close. No server write — onboarding is device-locked, not per-user.
  function dismiss() {
    if (currentTour) localStorage.setItem(`dotcom-tour-seen:${currentTour}`, '1')
    closeOnborda()
  }

  const isLast = currentStep + 1 === totalSteps

  return (
    <div ref={cardRef} className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-72 max-w-[calc(100vw-2rem)] p-5 text-slate-900 dark:text-white">
      {/* Arrow pointer */}
      <span className="text-white dark:text-slate-800">{arrow}</span>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {step.icon && (
            <span className="text-xl leading-none">{step.icon}</span>
          )}
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
            {step.title}
          </h3>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="Skip tour"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
        {step.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Previous"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 tabular-nums">
          {currentStep + 1} / {totalSteps}
        </span>

        <div className="flex items-center gap-1">
          {isLast ? (
            <button
              onClick={dismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition"
            >
              <CheckCircle2 size={13} />
              Done!
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title="Next"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
