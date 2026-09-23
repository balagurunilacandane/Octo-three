import type { TaskStatus } from '../domain/types'

const LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  waiting: 'Needs approval',
  completed: 'Done',
  failed: 'Failed',
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`pill pill-${status}`}>{LABEL[status]}</span>
}
