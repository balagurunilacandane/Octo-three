import type { AgentState, KnowledgeNode, Task } from '../domain/types'

/**
 * The wire format the renderer consumes. The built-in simulation emits exactly
 * these events; a real backend can stream the same JSON over WebSocket / SSE.
 *
 *   { "event": "agent.task.started", "agentId": "research-07", "taskId": "task-129", "department": "research" }
 */
export type AgentLocation =
  | { kind: 'desk' }
  | { kind: 'station'; teamId: string }
  | { kind: 'brain' }
  | { kind: 'agent'; agentId: string }
  | { kind: 'team'; teamId: string }

export type WorldEvent =
  | { event: 'agent.created'; agentId: string; department: string }
  | { event: 'agent.started'; agentId: string }
  | { event: 'agent.thinking'; agentId: string }
  | { event: 'agent.working'; agentId: string; taskId?: string }
  | { event: 'agent.researching'; agentId: string; taskId?: string }
  | { event: 'agent.walking'; agentId: string; to: AgentLocation }
  | { event: 'agent.arrived'; agentId: string }
  | { event: 'agent.communicating'; agentId: string; withAgentId?: string }
  | { event: 'agent.waiting'; agentId: string; taskId?: string }
  | { event: 'agent.completed'; agentId: string; taskId?: string }
  | { event: 'agent.error'; agentId: string; message?: string }
  | { event: 'agent.idle'; agentId: string }
  | { event: 'agent.task.started'; agentId: string; taskId: string; department: string }
  | { event: 'task.created'; task: Task }
  | { event: 'task.assigned'; taskId: string; agentId: string }
  | { event: 'task.started'; taskId: string }
  | { event: 'task.waiting'; taskId: string; reason: string }
  | { event: 'task.approved'; taskId: string }
  | { event: 'task.rejected'; taskId: string; reason?: string }
  | { event: 'task.completed'; taskId: string; result?: string; tokens?: number }
  | { event: 'task.failed'; taskId: string; error?: string }
  | { event: 'knowledge.created'; node: KnowledgeNode }
  | { event: 'knowledge.connected'; source: string; target: string; strength?: number }
  | { event: 'department.activity.changed'; department: string; activity: number }
  | { event: 'data.transfer'; transferId: string; from: DataEndpoint; to: DataEndpoint; dataType: DataType }
  | { event: 'data.arrived'; transferId: string }
  | { event: 'brain.processing'; durationSec: number }

export type DataEndpoint = { kind: 'team'; teamId: string } | { kind: 'brain' } | { kind: 'agent'; agentId: string }
export type DataType = 'research' | 'insight' | 'result' | 'message' | 'alert'

export const DATA_COLORS: Record<DataType, string> = {
  research: '#8fd3c8',
  insight: '#b8aee6',
  result: '#c6d68a',
  message: '#e6cf8f',
  alert: '#e3a08a',
}

export const STATE_FROM_EVENT: Partial<Record<WorldEvent['event'], AgentState>> = {
  'agent.thinking': 'thinking',
  'agent.working': 'working',
  'agent.researching': 'researching',
  'agent.walking': 'walking',
  'agent.communicating': 'communicating',
  'agent.waiting': 'waiting',
  'agent.completed': 'completed',
  'agent.error': 'error',
  'agent.idle': 'idle',
  'agent.started': 'idle',
}
