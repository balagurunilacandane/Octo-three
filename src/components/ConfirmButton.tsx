import { useEffect, useState, type ReactNode } from 'react'

/** Two-step destructive button ("Delete" → "Click again to confirm"). Works where native confirm() is blocked. */
export function ConfirmButton({ onConfirm, children, className = 'btn danger', disabled }: { onConfirm: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <button className={className} disabled={disabled} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? 'Click again to confirm' : children}
    </button>
  )
}
