import { useEffect, useRef, useState } from 'react'
import { useWorld, type Tab } from '../state/worldStore'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'world', label: 'World' },
  { key: 'teams', label: 'Teams' },
  { key: 'agents', label: 'Agents' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'tools', label: 'Tools' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
]

export function TopBar() {
  const view = useWorld((s) => s.view)
  const tab = useWorld((s) => s.tab)
  const setTab = useWorld((s) => s.setTab)
  const setView = useWorld((s) => s.setView)
  const advanced = useWorld((s) => s.advanced)
  const setAdvanced = useWorld((s) => s.setAdvanced)
  const current = useWorld((s) => (s.currentWorldId ? s.bundles[s.currentWorldId]?.world : undefined))
  const waiting = useWorld((s) => (s.currentWorldId ? (s.bundles[s.currentWorldId]?.tasks.filter((t) => t.status === 'waiting').length ?? 0) : 0))

  return (
    <header className="topbar">
      <button className="brand" onClick={() => setView('home')} title="My Worlds">
        <span className="brand-mark" />
        <span className="brand-text">AI WORLDS</span>
      </button>
      {view !== 'wizard' && <WorldSwitcher />}
      {view === 'world' && current && (
        <nav className="tabs" aria-label="World sections">
          {TABS.map((t) => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === 'tasks' && waiting > 0 && <span className="tab-badge">{waiting}</span>}
            </button>
          ))}
        </nav>
      )}
      <div className="topbar-right">
        <label className="switch" title="Advanced mode exposes models, tools, MCP servers, runtime and logs">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          <span className="switch-track" />
          <span className="switch-label">Advanced</span>
        </label>
      </div>
    </header>
  )
}

function WorldSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const order = useWorld((s) => s.order)
  const bundles = useWorld((s) => s.bundles)
  const currentWorldId = useWorld((s) => s.currentWorldId)
  const enterWorld = useWorld((s) => s.enterWorld)
  const setView = useWorld((s) => s.setView)
  const current = currentWorldId ? bundles[currentWorldId]?.world : undefined

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="switcher" ref={ref}>
      <button className="switcher-button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{current?.icon ?? '🌐'}</span>
        <span className="switcher-name">{current?.name ?? 'Choose a World'}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="switcher-menu" role="listbox">
          <div className="menu-title">Your Worlds</div>
          {order.map((id) => {
            const w = bundles[id]?.world
            if (!w) return null
            return (
              <button
                key={id}
                role="option"
                aria-selected={id === currentWorldId}
                className={`menu-item${id === currentWorldId ? ' active' : ''}`}
                onClick={() => {
                  enterWorld(id)
                  setOpen(false)
                }}
              >
                <span>{w.icon}</span>
                <span className="menu-item-name">{w.name}</span>
                <span className="muted small">
                  {w.agents.length} agents · {w.teams.length} teams
                </span>
              </button>
            )
          })}
          <button
            className="menu-item create"
            onClick={() => {
              setView('wizard')
              setOpen(false)
            }}
          >
            ＋ Create New World
          </button>
        </div>
      )}
    </div>
  )
}
