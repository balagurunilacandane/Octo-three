import { useState } from 'react'
import { MODEL_OPTIONS, TOOL_CATALOG } from '../domain/catalog'
import { agentFromDefinition } from '../domain/factory'
import type { AgentDefinition } from '../domain/planner'
import type { AccessoryType, Agent } from '../domain/types'
import { useWorld } from '../state/worldStore'
import { getPlanner } from '../tasks/TaskSystem'
import { formatTokens } from '../ui/hooks'
import { ConfirmButton } from '../components/ConfirmButton'

const ACCESSORIES: AccessoryType[] = ['none', 'antenna', 'headset', 'backpack', 'badge', 'cap']

export function AgentsPage({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  if (!b) return null
  const teams = b.world.teams.map((id) => b.teams[id]).filter(Boolean)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Agents</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>
          ＋ Create Agent
        </button>
      </div>
      {teams.map((t) => (
        <div key={t.id} className="agent-team">
          <div className="agent-team-head" style={{ color: t.color }}>
            {t.icon} {t.name}
          </div>
          <div className="agent-grid">
            {t.agentIds.map((id) => {
              const a = b.agents[id]
              if (!a) return null
              return (
                <button key={id} className="card agent-card" style={{ ['--accent' as string]: a.appearance.accent }} onClick={() => setEditing(id)}>
                  <div className="avatar" style={{ ['--visor' as string]: a.appearance.visor }} />
                  <div className="grow">
                    <div className="strong">{a.name}</div>
                    <div className="muted small">{a.role}</div>
                  </div>
                  <div className="muted tiny right">
                    {formatTokens(a.tokensUsed)} tok
                    <br />
                    {a.tasksCompleted} done
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {creating && <CreateAgentDialog worldId={worldId} onClose={() => setCreating(false)} />}
      {editing && b.agents[editing] && <AgentEditor worldId={worldId} agent={b.agents[editing]} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Non-technical agent creation: describe the job and what success looks like. */
function CreateAgentDialog({ worldId, onClose }: { worldId: string; onClose: () => void }) {
  const b = useWorld((s) => s.bundles[worldId])!
  const advanced = useWorld((s) => s.advanced)
  const addAgent = useWorld((s) => s.addAgent)
  const teams = b.world.teams.map((id) => b.teams[id]).filter(Boolean)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [what, setWhat] = useState('')
  const [success, setSuccess] = useState('')
  const [def, setDef] = useState<AgentDefinition | null>(null)

  const generate = async () => setDef(await getPlanner().defineAgent(what, success, b.teams[teamId]?.name))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create an Agent</h2>
        <label className="field">
          <span>Team</span>
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>What should this agent do?</span>
          <textarea className="input" rows={2} autoFocus placeholder="Research competitors and summarize important findings" value={what} onChange={(e) => setWhat(e.target.value)} />
        </label>
        <label className="field">
          <span>What should success look like?</span>
          <textarea className="input" rows={2} placeholder="A clear report with sources, pricing and major differences" value={success} onChange={(e) => setSuccess(e.target.value)} />
        </label>
        {def && (
          <div className="card-lite">
            <div className="strong">{def.name}</div>
            <div className="muted small">Output: {def.expectedOutput}</div>
            <div className="muted small">Tools: {def.tools.map((t) => TOOL_CATALOG.find((x) => x.id === t)?.name ?? t).join(', ')}</div>
            {advanced && <pre className="code small">{def.instructions}</pre>}
          </div>
        )}
        <div className="wizard-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {!def ? (
            <button className="btn primary" disabled={!what.trim() || !teamId} onClick={generate}>
              ✨ Generate agent
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                const team = b.teams[teamId]
                if (team) addAgent(worldId, agentFromDefinition(worldId, team, def))
                onClose()
              }}
            >
              Create Agent
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Simple fields for everyone; model / instructions / tools / MCP / runtime in Advanced Mode. */
function AgentEditor({ worldId, agent, onClose }: { worldId: string; agent: Agent; onClose: () => void }) {
  const advanced = useWorld((s) => s.advanced)
  const updateAgent = useWorld((s) => s.updateAgent)
  const removeAgent = useWorld((s) => s.removeAgent)
  const enterWorld = useWorld((s) => s.enterWorld)
  const selectAgent = useWorld((s) => s.selectAgent)
  const tools = useWorld((s) => s.bundles[worldId]?.tools)
  const [draft, setDraft] = useState<Agent>(structuredClone(agent))
  const cfg = draft.config
  const setCfg = (patch: Partial<Agent['config']>) => setDraft((d) => ({ ...d, config: { ...d.config, ...patch } }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{draft.name}</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Role</span>
            <input className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          </label>
          <label className="field span2">
            <span>Goal</span>
            <input className="input" value={draft.goal ?? ''} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
          </label>
          <label className="field span2">
            <span>Success looks like</span>
            <input className="input" value={draft.successCriteria ?? ''} onChange={(e) => setDraft({ ...draft, successCriteria: e.target.value })} />
          </label>
          <label className="field">
            <span>Visor colour</span>
            <input type="color" className="color" value={draft.appearance.visor} onChange={(e) => setDraft({ ...draft, appearance: { ...draft.appearance, visor: e.target.value } })} />
          </label>
          <label className="field">
            <span>Accessory</span>
            <select className="input" value={draft.appearance.accessory} onChange={(e) => setDraft({ ...draft, appearance: { ...draft.appearance, accessory: e.target.value as AccessoryType } })}>
              {ACCESSORIES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>

        {advanced ? (
          <>
            <div className="section-title">Advanced configuration</div>
            <div className="form-grid">
              <label className="field">
                <span>Model</span>
                <select className="input" value={cfg.model} onChange={(e) => setCfg({ model: e.target.value })}>
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>MCP servers (comma separated)</span>
                <input className="input" value={cfg.mcpServers.join(', ')} placeholder="https://mcp.example.com/sse" onChange={(e) => setCfg({ mcpServers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <label className="field span2">
                <span>Instructions (system prompt)</span>
                <textarea className="input mono" rows={5} value={cfg.instructions} onChange={(e) => setCfg({ instructions: e.target.value })} />
              </label>
              <div className="field span2">
                <span>Tools</span>
                <div className="chips-wrap">
                  {TOOL_CATALOG.map((t) => {
                    const on = cfg.tools.includes(t.id)
                    return (
                      <button key={t.id} className={`chip toggle${on ? ' on' : ''}`} onClick={() => setCfg({ tools: on ? cfg.tools.filter((x) => x !== t.id) : [...cfg.tools, t.id] })} title={tools?.[t.id] ? 'Connected' : 'Not connected in this World'}>
                        {t.icon} {t.name}
                        {!tools?.[t.id] && ' ·'}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="field">
                <span>Memory</span>
                <label className="check-row">
                  <input type="checkbox" checked={cfg.memory.world} onChange={(e) => setCfg({ memory: { ...cfg.memory, world: e.target.checked } })} /> World knowledge
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={cfg.memory.team} onChange={(e) => setCfg({ memory: { ...cfg.memory, team: e.target.checked } })} /> Team knowledge
                </label>
              </div>
              <div className="field">
                <span>Runtime</span>
                <label className="range">
                  Temperature {cfg.temperature.toFixed(2)}
                  <input type="range" min={0} max={1} step={0.05} value={cfg.temperature} onChange={(e) => setCfg({ temperature: Number(e.target.value) })} />
                </label>
                <label className="range">
                  Max tokens
                  <input className="input" type="number" min={256} step={256} value={cfg.maxTokens} onChange={(e) => setCfg({ maxTokens: Number(e.target.value) })} />
                </label>
                <label className="range">
                  Timeout (s)
                  <input className="input" type="number" min={10} value={cfg.timeoutSec} onChange={(e) => setCfg({ timeoutSec: Number(e.target.value) })} />
                </label>
              </div>
            </div>
            <div className="muted small">
              Usage: {formatTokens(agent.tokensUsed)} tokens · est. cost ${((agent.tokensUsed / 1_000_000) * 6).toFixed(4)} (illustrative rate)
            </div>
          </>
        ) : (
          <p className="muted small">Turn on Advanced mode (top right) to configure the model, instructions, tools, memory, MCP servers and runtime.</p>
        )}

        <div className="wizard-actions">
          <ConfirmButton className="btn danger ghost" onConfirm={() => (removeAgent(worldId, agent.id), onClose())}>
            Remove
          </ConfirmButton>
          <span className="grow" />
          <button
            className="btn ghost"
            onClick={() => {
              onClose()
              enterWorld(worldId, 'world')
              setTimeout(() => selectAgent(agent.id), 50)
            }}
          >
            Show in world
          </button>
          <button
            className="btn primary"
            onClick={() => {
              updateAgent(worldId, agent.id, draft)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
