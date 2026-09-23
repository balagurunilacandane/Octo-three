import { useWorld } from '../state/worldStore'
import { approveTask, rejectTask } from '../tasks/TaskSystem'

/** Human-in-the-loop: tasks that need your approval before agents continue. */
export function ApprovalsTray({ worldId }: { worldId: string }) {
  const tasks = useWorld((s) => s.bundles[worldId]?.tasks)
  const teams = useWorld((s) => s.bundles[worldId]?.teams)
  const waiting = (tasks ?? []).filter((t) => t.status === 'waiting')
  if (!waiting.length) return null
  return (
    <div className="approvals">
      <div className="approvals-title">⚠ Needs your approval</div>
      {waiting.map((t) => (
        <div key={t.id} className="approval">
          <div className="grow">
            <div className="approval-task">{t.title}</div>
            <div className="muted small">
              {teams?.[t.targetDepartment]?.name} wants to: <b>{t.approval?.reason ?? 'continue'}</b>
            </div>
          </div>
          <button className="btn small primary" onClick={() => approveTask(worldId, t.id)}>
            Approve
          </button>
          <button className="btn small ghost" onClick={() => rejectTask(worldId, t.id)}>
            Reject
          </button>
        </div>
      ))}
    </div>
  )
}
