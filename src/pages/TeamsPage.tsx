import { useState } from 'react'
import type { BuildingType } from '../domain/types'
import type { ProposedTeam } from '../domain/planner'
import { useWorld } from '../state/worldStore'
import { getPlanner } from '../tasks/TaskSystem'
import { ColorInput } from '../components/ColorInput'
import { ConfirmButton } from '../components/ConfirmButton'

const BUILDINGS: { key: BuildingType; label: string }[] = [
  { key: 'research', label: 'Laboratory' },
  { key: 'strategy', label: 'War room' },
  { key: 'data', label: 'Data centre' },
  { key: 'design', label: 'Design studio' },
  { key: 'operations', label: 'Control centre' },
  { key: 'product', label: 'Prototype lab' },
  { key: 'marketing', label: 'Broadcast tower' },
  { key: 'studio', label: 'Media studio' },
  { key: 'engineering', label: 'Code tower' },
  { key: 'generic', label: 'Custom hub' },
]

export function TeamsPage({ worldId }: { worldId: string }) {
  const b = useWorld((s) => s.bundles[worldId])
  const updateTeam = useWorld((s) => s.updateTeam)
  const removeTeam = useWorld((s) => s.removeTeam)
  const enterWorld = useWorld((s) => s.enterWorld)
  const selectDepartment = useWorld((s) => s.selectDepartment)
  const [adding, setAdding] = useState(false)
  if (!b) return null
  const teams = b.world.teams.map((id) => b.teams[id]).filter(Boolean)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Teams</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>
          ＋ Add Team
        </button>
      </div>
      <p className="muted">Teams are the departments of your World. Each one gets its own building and agents.</p>
      <div className="team-grid">
        {teams.map((t) => (
          <div key={t.id} className="card team-card" style={{ ['--accent' as string]: t.color }}>
            <div className="team-card-head">
              <input className="input icon" value={t.icon ?? ''} maxLength={4} onChange={(e) => updateTeam(worldId, t.id, { icon: e.target.value })} />
              <input className="input inline strong" value={t.name} onChange={(e) => updateTeam(worldId, t.id, { name: e.target.value })} />
              <ColorInput value={t.color ?? '#a78bfa'} onCommit={(c) => updateTeam(worldId, t.id, { color: c })} title="Team colour" />
            </div>
            <textarea className="input" rows={2} value={t.description ?? ''} placeholder="What does this team do?" onChange={(e) => updateTeam(worldId, t.id, { description: e.target.value })} />
            <div className="row">
              <label className="muted small">Building</label>
              <select className="input" value={t.buildingType ?? 'generic'} onChange={(e) => updateTeam(worldId, t.id, { buildingType: e.target.value as BuildingType })}>
                {BUILDINGS.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="muted small">{t.agentIds.map((id) => b.agents[id]?.name).filter(Boolean).join(' · ')}</div>
            <div className="row end">
              <button
                className="btn small ghost"
                onClick={() => {
                  enterWorld(worldId, 'world')
                  setTimeout(() => selectDepartment(t.id), 50)
                }}
              >
                Show in world
              </button>
              <ConfirmButton className="btn small danger" disabled={teams.length <= 1} onConfirm={() => removeTeam(worldId, t.id)}>
                Remove
              </ConfirmButton>
            </div>
          </div>
        ))}
      </div>
      {adding && <AddTeamDialog worldId={worldId} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddTeamDialog({ worldId, onClose }: { worldId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [proposal, setProposal] = useState<ProposedTeam | null>(null)
  const addTeam = useWorld((s) => s.addTeam)

  const suggest = async () => setProposal(await getPlanner().proposeTeam(name.trim(), desc.trim()))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create Team</h2>
        <label className="field">
          <span>Team name</span>
          <input className="input" autoFocus placeholder="Customer Research" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>What should this team do?</span>
          <input className="input" placeholder="Understand customers and competitors" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && suggest()} />
        </label>
        {!proposal ? (
          <div className="wizard-actions">
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!name.trim()} onClick={suggest}>
              ✨ Suggest agents
            </button>
          </div>
        ) : (
          <>
            <div className="section-title">Suggested agents</div>
            {proposal.agents.map((a, i) => (
              <label key={a.key} className="check-row">
                <input
                  type="checkbox"
                  checked={a.include}
                  onChange={(e) => setProposal((p) => (p ? { ...p, agents: p.agents.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) } : p))}
                />
                <span>
                  <b>{a.name}</b> <span className="muted small">— {a.role}</span>
                </span>
              </label>
            ))}
            <div className="muted small">
              Building: {proposal.icon} {proposal.building === 'generic' ? 'custom hub (auto-themed)' : proposal.building}
            </div>
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setProposal(null)}>
                ← Back
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  addTeam(worldId, { ...proposal, name: name.trim() || proposal.name, description: desc.trim() || proposal.description })
                  onClose()
                }}
              >
                Create Team
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
