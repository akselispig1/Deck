import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  label?: string
}

// A bottom sheet on mobile, a centred panel on desktop. Scrim dims the app;
// tapping it or pressing Escape closes. Nothing here has a hard border.
export function Sheet({ open, onClose, children, label }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while the sheet is up.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="absolute inset-0 bg-ink/25 deck-fade" onClick={onClose} aria-hidden />
      <div
        className="deck-sheet md:deck-fade relative w-full max-h-[92vh] overflow-y-auto rounded-t-[20px] bg-card shadow-sheet md:max-w-content md:rounded-card md:shadow-card"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* grabber, mobile only */}
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-hairline" />
        </div>
        {children}
      </div>
    </div>
  )
}
