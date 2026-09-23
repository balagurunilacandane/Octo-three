import { useEffect, useRef, useState } from 'react'
import { MODEL_OPTIONS } from '../domain/catalog'
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

const PROVIDER_GLYPH: Record<string, string> = { Claude: '✳', GPT: '◎', Gemini: '✦', Ollama: '🦙' }

export function TopBar() {
  const view = useWorld((s) => s.view)
  const tab = useWorld((s) => s.tab)
  const setTab = useWorld((s) => s.setTab)
  const setView = useWorld((s) => s.setView)
  const setTaskFilter = useWorld((s) => s.setTaskFilter)
  const advanced = useWorld((s) => s.advanced)
  const setAdvanced = useWorld((s) => s.setAdvanced)
  const bundle = useWorld((s) => (s.currentWorldId ? s.bundles[s.currentWorldId] : undefined))
  const waiting = bundle?.tasks.filter((t) => t.status === 'waiting').length ?? 0
  const inWorld = view === 'world' && !!bundle
  const tools = bundle ? Object.values(bundle.tools) : []
  const providers = bundle ? [...new Set(Object.values(bundle.agents).map((a) => MODEL_OPTIONS.find((m) => m.id === a.config.model)?.provider ?? 'Claude'))] : []

  return (
    <header className="topbar">
      <button className="brand" onClick={() => setView('home')} title="My Worlds">
        <span className="brand-text serif">AI Worlds</span>
        <span className="brand-ver">v1</span>
      </button>
      {view !== 'wizard' && <WorldSwitcher />}
      {inWorld && (
        <nav className="tabs" aria-label="World sections">
          {TABS.map((t) => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="topbar-right">
        {inWorld && tools.length > 0 && (
          <div className="tb-group hide-xl" title="Tools this World is connected to">
            <span className="tb-label">
              <span className="live" /> <span className="tb-label-text">Connected to</span>
            </span>
            {tools.slice(0, 8).map((t) => (
              <span key={t.id} className="tb-tile" title={t.name}>
                {t.icon}
              </span>
            ))}
          </div>
        )}
        {inWorld && providers.length > 0 && (
          <div className="tb-group hide-lg" title="Models your agents run on">
            <span className="tb-label">
              <span className="live" /> <span className="tb-label-text">Runs headless on</span>
            </span>
            {providers.map((p) => (
              <span key={p} className="tb-tile" title={p}>
                {PROVIDER_GLYPH[p] ?? '◇'}
              </span>
            ))}
          </div>
        )}
        {inWorld && (
          <button
            className={`tb-warn${waiting ? ' on' : ''}`}
            title="Tasks waiting for your approval"
            onClick={() => {
              setTab('world')
              setTaskFilter('waiting')
            }}
          >
            ⚠ {waiting}
          </button>
        )}
        <Clock />
        <label className="switch" title="Advanced mode exposes models, tools, MCP servers, runtime and logs">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          <span className="switch-track" />
          <span className="switch-label">Advanced</span>
        </label>
      </div>
    </header>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const h = now.getHours()
  const txt = `${String(h % 12 || 12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return (
    <span className="clock serif hide-sm">
      {txt} <span className="clock-ampm">{h < 12 ? 'am' : 'pm'}</span>
    </span>
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
            + Create New World
          </button>
        </div>
      )}
    </div>
  )
}
