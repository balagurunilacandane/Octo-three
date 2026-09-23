import { useEffect, useRef, useState } from 'react'
import { planRequest, submitPlan } from '../tasks/TaskSystem'
import { useWorld } from '../state/worldStore'

const EXAMPLES = [
  'Research the top 20 competitors and prepare a comparison.',
  'Draft a launch campaign and publish it on social.',
  'Analyze last month’s metrics and summarize the trends.',
  'Design a new landing page hero.',
]

/** “Tell your team what you want done” — the natural-language entry point. */
export function CommandBar({ worldId }: { worldId: string }) {
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const prefill = useWorld((s) => s.selection)
  const teams = useWorld((s) => s.bundles[worldId]?.teams)
  const placeholder = EXAMPLES[Math.floor(Date.now() / 60000) % EXAMPLES.length]

  // Selecting a department suggests addressing it directly.
  useEffect(() => {
    if (prefill?.kind === 'team' && teams?.[prefill.id] && !text) setText(`Ask ${teams[prefill.id].name} to `)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.id])

  useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 6000)
    return () => clearTimeout(id)
  }, [note])

  const send = async () => {
    const request = text.trim()
    if (!request) return
    const plan = await planRequest(worldId, request)
    if (!plan) return
    const ok = submitPlan(worldId, plan, request)
    setNote(ok ? plan.explanation : 'This World is connected to an external backend — the request was logged but not simulated.')
    setText('')
  }

  return (
    <div className="command">
      {note && <div className="command-note">🧭 {note}</div>}
      <form
        className="command-bar"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <span className="command-icon">✦</span>
        <input ref={input} className="command-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Tell your team what you want done — “${placeholder}”`} aria-label="Tell your team what you want done" />
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
