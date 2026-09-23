import { useState } from 'react'
import type { ConnectionStatus } from '../events/realtime'
import { useWorld } from '../state/worldStore'
import { getPlanner } from '../tasks/TaskSystem'

export function SettingsPage({ worldId, connection }: { worldId: string; connection: ConnectionStatus }) {
  const b = useWorld((s) => s.bundles[worldId])
  const advanced = useWorld((s) => s.advanced)
  const updateWorld = useWorld((s) => s.updateWorld)
  const updateRuntime = useWorld((s) => s.updateRuntime)
  const addPermissions = useWorld((s) => s.addPermissions)
  const removePermission = useWorld((s) => s.removePermission)
  const deleteWorld = useWorld((s) => s.deleteWorld)
  const [policy, setPolicy] = useState('')
  const [endpoint, setEndpoint] = useState(b?.runtime.endpoint ?? '')
  if (!b) return null

  const applyPolicy = async () => {
    const rules = await getPlanner().parsePolicy(policy, b)
    if (rules.length) addPermissions(worldId, rules)
    setPolicy('')
  }

  const exportWorld = () => {
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${b.world.name.replace(/\W+/g, '-').toLowerCase()}.world.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page settings">
      <h1>Settings</h1>

      <section className="card">
        <div className="card-title">World</div>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input className="input" value={b.world.name} onChange={(e) => updateWorld(worldId, { name: e.target.value })} />
          </label>
          <label className="field">
            <span>Icon</span>
            <input className="input" value={b.world.icon ?? ''} maxLength={4} onChange={(e) => updateWorld(worldId, { icon: e.target.value })} />
          </label>
          <label className="field span2">
            <span>Description</span>
            <input className="input" value={b.world.description ?? ''} onChange={(e) => updateWorld(worldId, { description: e.target.value })} />
          </label>
          <label className="field span2">
            <span>How proactive should your teams be?</span>
            <input type="range" min={0} max={1} step={0.05} value={b.runtime.autonomy} onChange={(e) => updateRuntime(worldId, { autonomy: Number(e.target.value) })} />
            <span className="muted small">{b.runtime.autonomy < 0.05 ? 'Only work on what you ask' : b.runtime.autonomy < 0.5 ? 'Occasionally start useful work' : 'Keep busy on your goal'}</span>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-title">What needs your approval</div>
        <p className="muted small">Say it in plain language — e.g. “Let the marketing team create posts, but ask me before publishing.”</p>
        <div className="add-row">
          <input className="input" value={policy} placeholder="Let the marketing team create posts, but ask me before publishing." onChange={(e) => setPolicy(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyPolicy()} />
          <button className="btn primary" disabled={!policy.trim()} onClick={applyPolicy}>
            Apply
          </button>
        </div>
        <div className="perm-list">
          {b.permissions.map((p) => (
            <div key={p.id} className="perm">
              <span className={`perm-mode ${p.mode}`}>{p.mode === 'auto' ? '✓ AI can do automatically' : '⚠ Needs your approval'}</span>
              <span className="strong">{p.action}</span>
              <span className="muted small">{p.teamId === '*' ? 'All teams' : b.teams[p.teamId]?.name}</span>
              <span className="muted tiny grow">{p.source}</span>
              <button className="btn tiny ghost" onClick={() => removePermission(worldId, p.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {advanced && (
        <section className="card">
          <div className="card-title">Runtime & backend events</div>
          <p className="muted small">
            The renderer consumes WorldEvents (<code>agent.*</code>, <code>task.*</code>, <code>knowledge.*</code>, <code>data.*</code>). Use the built-in simulation or stream them from your orchestration backend.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Event source</span>
              <select className="input" value={b.runtime.eventSource} onChange={(e) => updateRuntime(worldId, { eventSource: e.target.value as typeof b.runtime.eventSource })}>
                <option value="simulated">Built-in simulation</option>
                <option value="websocket">WebSocket</option>
                <option value="sse">Server-Sent Events</option>
              </select>
            </label>
            <label className="field">
              <span>Endpoint</span>
              <div className="add-row">
                <input className="input" placeholder={b.runtime.eventSource === 'sse' ? 'https://api.example.com/worlds/…/events' : 'wss://api.example.com/worlds/…'} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
                <button className="btn" onClick={() => updateRuntime(worldId, { endpoint })}>
                  Connect
                </button>
              </div>
              {b.runtime.eventSource !== 'simulated' && <span className={`conn conn-${connection}`}>● {connection}</span>}
            </label>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={exportWorld}>
              Export World JSON
            </button>
          </div>
        </section>
      )}

      <section className="card danger-zone">
        <div className="card-title">Danger zone</div>
        <button className="btn danger" onClick={() => confirm(`Delete “${b.world.name}”? This cannot be undone.`) && deleteWorld(worldId)}>
          Delete this World
        </button>
      </section>
    </div>
  )
}
