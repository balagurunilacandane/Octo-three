import { useState } from 'react'
import { TOOL_CATALOG, WORLD_TEMPLATES } from '../domain/catalog'
import { bundleFromProposal } from '../domain/factory'
import { uid } from '../domain/ids'
import type { OrgProposal } from '../domain/planner'
import { useWorld } from '../state/worldStore'
import { getPlanner } from '../tasks/TaskSystem'

const STEPS = ['Describe', 'Goal', 'Teams', 'Agents', 'Tools', 'Review'] as const

/**
 * Create-a-World wizard for non-technical users: describe the project in
 * normal language, review the suggested organisation, create the World.
 */
export function CreateWorldWizard() {
  const [step, setStep] = useState(0)
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<string | undefined>()
  const [proposal, setProposal] = useState<OrgProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [newTeam, setNewTeam] = useState('')
  const createWorld = useWorld((s) => s.createWorld)
  const enterWorld = useWorld((s) => s.enterWorld)
  const setView = useWorld((s) => s.setView)
  const log = useWorld((s) => s.log)

  const propose = async (tpl?: string) => {
    setBusy(true)
    const p = await getPlanner().proposeOrganization(description, tpl ?? template)
    setProposal(p)
    setBusy(false)
    setStep(1)
  }

  const update = (fn: (p: OrgProposal) => OrgProposal) => setProposal((p) => (p ? fn(structuredClone(p)) : p))

  const addTeam = async () => {
    if (!newTeam.trim()) return
    const t = await getPlanner().proposeTeam(newTeam.trim(), '')
    update((p) => ({ ...p, teams: [...p.teams, t] }))
    setNewTeam('')
  }

  const create = () => {
    if (!proposal) return
    const bundle = bundleFromProposal(proposal)
    const id = createWorld(bundle)
    log(id, { text: 'World created. Your teams are ready — tell them what to work on.', kind: 'success' })
    enterWorld(id, 'world')
  }

  const includedTeams = proposal?.teams.filter((t) => t.include) ?? []
  const agentCount = includedTeams.reduce((n, t) => n + Math.max(1, t.agents.filter((a) => a.include).length), 0)

  return (
    <div className="page wizard">
      <div className="wizard-card">
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
              <span>{i < step ? '✓' : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section>
            <h2>Create your World</h2>
            <p className="muted">What are you building?</p>
            <div className="template-grid">
              {WORLD_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  className={`template${template === t.key ? ' selected' : ''}`}
                  onClick={() => {
                    setTemplate(t.key)
                    setDescription('')
                  }}
                >
                  <span className="template-icon">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="or">or describe your project</div>
            <textarea
              className="input big"
              rows={3}
              placeholder="“I want to build a YouTube channel about personal finance.”"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (e.target.value) setTemplate(undefined)
              }}
            />
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setView('home')}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy || (!description.trim() && !template)} onClick={() => propose()}>
                ✨ Suggest my organisation
              </button>
            </div>
          </section>
        )}

        {step === 1 && proposal && (
          <section>
            <h2>What is the goal?</h2>
            <p className="muted">Optional — your teams will use it to prioritise work.</p>
            <input
              className="input big"
              placeholder="e.g. Publish two videos a week and reach 10k subscribers"
              value={proposal.goal}
              onChange={(e) => update((p) => ({ ...p, goal: e.target.value }))}
              autoFocus
            />
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setStep(0)}>
                ← Back
              </button>
              <button className="btn primary" onClick={() => setStep(2)}>
                Continue →
              </button>
            </div>
          </section>
        )}

        {step === 2 && proposal && (
          <section>
            <h2>Suggested teams</h2>
            <p className="muted">These teams become the departments of your World. Rename, remove or add your own.</p>
            <div className="list">
              {proposal.teams.map((t, i) => (
                <div key={t.key} className={`list-row${t.include ? '' : ' off'}`} style={{ ['--accent' as string]: t.color }}>
                  <input type="checkbox" checked={t.include} onChange={(e) => update((p) => ((p.teams[i].include = e.target.checked), p))} />
                  <span className="row-icon">{t.icon}</span>
                  <input className="input inline" value={t.name} onChange={(e) => update((p) => ((p.teams[i].name = e.target.value), p))} />
                  <span className="muted small grow">{t.description}</span>
                </div>
              ))}
            </div>
            <div className="add-row">
              <input className="input" placeholder="Add a custom team, e.g. “Competitor Intelligence”" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeam()} />
              <button className="btn" onClick={addTeam}>
                ＋ Add Team
              </button>
            </div>
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn primary" disabled={!includedTeams.length} onClick={() => setStep(3)}>
                Continue →
              </button>
            </div>
          </section>
        )}

        {step === 3 && proposal && (
          <section>
            <h2>Suggested agents</h2>
            <p className="muted">Each agent is an AI teammate. You can change them any time.</p>
            <div className="agent-columns">
              {proposal.teams.map((t, ti) =>
                t.include ? (
                  <div key={t.key} className="agent-col" style={{ ['--accent' as string]: t.color }}>
                    <div className="agent-col-head">
                      {t.icon} {t.name}
                    </div>
                    {t.agents.map((a, ai) => (
                      <label key={a.key} className="check-row">
                        <input type="checkbox" checked={a.include} onChange={(e) => update((p) => ((p.teams[ti].agents[ai].include = e.target.checked), p))} />
                        <span>
                          <b>{a.name}</b>
                          <span className="muted small"> — {a.role}</span>
                        </span>
                      </label>
                    ))}
                    <button
                      className="btn tiny ghost"
                      onClick={() =>
                        update((p) => {
                          p.teams[ti].agents.push({ key: uid('pa'), name: `${t.name} Agent ${p.teams[ti].agents.length + 1}`, role: 'Supports the team', include: true })
                          return p
                        })
                      }
                    >
                      ＋ agent
                    </button>
                  </div>
                ) : null,
              )}
            </div>
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button className="btn primary" onClick={() => setStep(4)}>
                Continue →
              </button>
            </div>
          </section>
        )}

        {step === 4 && proposal && (
          <section>
            <h2>Connect tools <span className="muted">(optional)</span></h2>
            <p className="muted">Tools let agents act. You can skip this and connect them later.</p>
            <div className="tool-grid">
              {TOOL_CATALOG.map((t) => {
                const on = proposal.tools.includes(t.id)
                return (
                  <button
                    key={t.id}
                    className={`tool${on ? ' on' : ''}`}
                    onClick={() => update((p) => ({ ...p, tools: on ? p.tools.filter((x) => x !== t.id) : [...p.tools, t.id] }))}
                  >
                    <span className="tool-icon">{t.icon}</span>
                    <span>
                      <b>{t.name}</b>
                      <span className="muted small block">{t.description}</span>
                    </span>
                    <span className="tool-state">{on ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setStep(3)}>
                ← Back
              </button>
              <button className="btn primary" onClick={() => setStep(5)}>
                Continue →
              </button>
            </div>
          </section>
        )}

        {step === 5 && proposal && (
          <section className="review">
            <div className="muted small upper">Your new World</div>
            <div className="review-name">
              <input className="input icon" value={proposal.icon} onChange={(e) => update((p) => ({ ...p, icon: e.target.value }))} maxLength={4} />
              <input className="input big" value={proposal.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} />
            </div>
            {proposal.goal && <p className="muted">Goal: {proposal.goal}</p>}
            <div className="review-grid">
              <div>
                <div className="upper small muted">Teams</div>
                {includedTeams.map((t) => (
                  <div key={t.key}>
                    ✓ {t.icon} {t.name}
                  </div>
                ))}
              </div>
              <div>
                <div className="upper small muted">Agents</div>
                <div>✓ {agentCount} suggested agents</div>
                <div className="upper small muted" style={{ marginTop: 12 }}>
                  Tools
                </div>
                <div>{proposal.tools.length ? proposal.tools.map((id) => TOOL_CATALOG.find((t) => t.id === id)?.icon).join(' ') : 'None yet'}</div>
              </div>
            </div>
            <div className="wizard-actions">
              <button className="btn ghost" onClick={() => setStep(2)}>
                Customize
              </button>
              <button className="btn primary big" disabled={!proposal.name.trim()} onClick={create}>
                Create World
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
