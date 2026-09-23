import { useEffect, useRef } from 'react'

/** Colour picker that commits only when the picker closes (native `change`), not on every drag step. */
export function ColorInput({ value, onCommit, title }: { value: string; onCommit: (v: string) => void; title?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = () => onCommit(el.value)
    el.addEventListener('change', h)
    return () => el.removeEventListener('change', h)
  }, [onCommit])
  return <input ref={ref} type="color" className="color" defaultValue={value} key={value} title={title} />
}
