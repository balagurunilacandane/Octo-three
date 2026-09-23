import { memo, useEffect, useRef, useState } from 'react'
import { archetypeForTeam } from '../domain/planner'
import type { WorldRuntime } from '../sim/WorldRuntime'
import { useWorld } from '../state/worldStore'
import { approveTask, rejectTask } from '../tasks/TaskSystem'
import { mutedAccent } from '../world/materials'

/**
 * Floating stat card for a department (rendered via drei <Html>, which is a
 * separate React root, so the runtime is passed as a prop). Counts come from
 * the store; activity/attention are written to the DOM on an interval.
 */
function DepartmentCardImpl({ runtime, teamId }: { runtime: WorldRuntime; teamId: string }) {
  const worldId = runtime.worldId
  const team = useWorld((s) => s.bundles[worldId]?.teams[teamId])
  const tasks = useWorld((s) => s.bundles[worldId]?.tasks)
  const metrics = useWorld((s) => s.bundles[worldId]?.metrics?.[teamId])
  const selected = useWorld((s) => s.selection?.kind === 'team' && s.selection.id === teamId)
  const selectDepartment = useWorld((s) => s.selectDepartment)
  const [open, setOpen] = useState(false)
  const dot = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      if (dot.current) dot.current.style.opacity = runtime.attentionOf(teamId) > 0.05 ? '1' : '0'
    }, 300)
    return () => clearInterval(id)
  }, [runtime, teamId])

  if (!team) return null
  const accent = mutedAccent(team.color ?? '#a78bfa')
  const arch = archetypeForTeam(team)
  const mine = (tasks ?? []).filter((t) => t.sourceDepartment === teamId || t.targetDepartment === teamId)
  const doing = mine.filter((t) => t.status === 'in_progress').length
  const next = (tasks ?? []).filter((t) => t.status === 'backlog' && t.sourceDepartment === teamId).length
  const done = mine.filter((t) => t.status === 'completed').length
  const waiting = mine.filter((t) => t.status === 'waiting')
  const m = metrics ?? [0, 0]

  return (
    <div
      className={`dept-card${selected ? ' selected' : ''}`}
      style={{ ['--accent' as string]: accent }}
      onClick={(e) => {
        e.stopPropagation()
        selectDepartment(teamId)
      }}
    >
      <div className="dc-head">
        <span className="dc-dot" />
        <span className="dc-name">{team.name}</span>
        <b className="dc-mini serif">{team.agentIds.length}</b>
        {waiting.length > 0 && <span className="dc-mini-warn">⚠</span>}
        <span ref={dot} className="dc-alert" title="Needs attention" />
      </div>
      <div className="dc-count">
        <span className="serif">{team.agentIds.length}</span>
        <span className="dc-unit">agents</span>
      </div>
      <div className="dc-stats">
        <div>
          <span>{arch.metrics[0]}</span>
          <b className="serif">{m[0]}</b>
        </div>
        <div>
          <span>{arch.metrics[1]}</span>
          <b className="serif">{m[1]}</b>
        </div>
      </div>
      <div className="dc-flow">
        <span>
          Doing <b className="serif">{doing}</b>
        </span>
        <span>
          Next <b className="serif">{next}</b>
        </span>
        <span>
          Done <b className="serif">{done}</b>
        </span>
      </div>
      {waiting.length > 0 && (
        <>
          <button
            className="dc-waiting"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
          >
            ⚠ {waiting.length} waiting approval
          </button>
          {open && (
            <div className="dc-approval" onClick={(e) => e.stopPropagation()}>
              <div className="dc-approval-title">{waiting[0].title}</div>
              <div className="dc-approval-reason">Wants to: {waiting[0].approval?.reason ?? 'continue'}</div>
              <div className="dc-approval-actions">
                <button className="pill-btn light" onClick={() => approveTask(worldId, waiting[0].id)}>
                  Approve
                </button>
                <button className="pill-btn" onClick={() => rejectTask(worldId, waiting[0].id)}>
                  Reject
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const DepartmentCard = memo(DepartmentCardImpl)

/** Small role tag above a desk ("GRAPHICS DESIGNER"). Leads get a star. */
export function RoleTag({ label, lead }: { label: string; lead?: boolean }) {
  return (
    <div className="role-tag">
      {lead && <span className="star">★</span>}
      {label}
    </div>
  )
}
