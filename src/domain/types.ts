// Core domain model for AI Worlds.
// Everything here is plain serialisable data: it can come from a database,
// a backend API or local persistence. The 3D renderer only consumes it.

export type ID = string

export type BuildingType =
  | 'research'
  | 'strategy'
  | 'data'
  | 'design'
  | 'operations'
  | 'product'
  | 'marketing'
  | 'studio'
  | 'engineering'
  | 'generic'

export type AgentState =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'walking'
  | 'researching'
  | 'communicating'
  | 'waiting'
  | 'completed'
  | 'error'

export type TaskStatus = 'backlog' | 'in_progress' | 'waiting' | 'completed' | 'failed'

export type ApprovalMode = 'auto' | 'approval'

export interface World {
  id: ID
  name: string
  description?: string
  icon?: string
  /** 'office' (default: desks + stat cards) or 'campus' (a distinct building per team). */
  theme?: 'office' | 'campus'
  goal?: string
  teams: ID[]
  agents: ID[]
  tools: ID[]
  knowledgeBaseId?: string
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: ID
  worldId: ID
  name: string
  description?: string
  color?: string
  icon?: string
  agentIds: ID[]
  buildingType?: BuildingType
}

export type AccessoryType = 'none' | 'antenna' | 'headset' | 'backpack' | 'badge' | 'cap'

export interface AgentAppearance {
  accent: string
  visor: string
  accessory: AccessoryType
}

/** Technical configuration — only surfaced in Advanced Mode. */
export interface AgentConfig {
  model: string
  instructions: string
  tools: ID[]
  memory: { world: boolean; team: boolean }
  temperature: number
  maxTokens: number
  timeoutSec: number
  mcpServers: string[]
}

export interface Agent {
  id: ID
  worldId: ID
  teamId: ID
  name: string
  role: string
  goal?: string
  successCriteria?: string
  expectedOutput?: string
  appearance: AgentAppearance
  config: AgentConfig
  tokensUsed: number
  tasksCompleted: number
}

export interface Task {
  id: ID
  worldId: ID
  title: string
  sourceDepartment: ID
  targetDepartment: ID
  assignedAgent: ID
  status: TaskStatus
  createdAt: number
  updatedAt: number
  /** Natural language request that spawned this task, if user-issued. */
  request?: string
  result?: string
  /** Set when the task contains an action that needs human approval. */
  approval?: { action: string; reason: string }
  tokens?: number
}

export interface KnowledgeNode {
  id: ID
  label: string
  departmentId: ID
  importance: number
  createdAt: number
}

export interface KnowledgeEdge {
  source: ID
  target: ID
  strength: number
}

export interface Tool {
  id: ID
  name: string
  icon: string
  description: string
  category: 'research' | 'communication' | 'data' | 'dev' | 'media' | 'commerce'
  /** Advanced-only connection details */
  kind: 'builtin' | 'mcp' | 'api' | 'webhook'
  endpoint?: string
}

export interface PermissionRule {
  id: ID
  teamId: ID | '*'
  action: string
  mode: ApprovalMode
  /** Plain-language source the rule was derived from. */
  source?: string
}

export interface ActivityEntry {
  id: ID
  at: number
  text: string
  kind: 'info' | 'task' | 'knowledge' | 'warning' | 'success' | 'error'
  teamId?: ID
  agentId?: ID
}

export interface RuntimeSettings {
  eventSource: 'simulated' | 'websocket' | 'sse'
  endpoint: string
  autonomy: number // 0..1 how often the simulated organisation starts work on its own
}

/** A World and everything it owns. Worlds never share entities. */
export interface WorldBundle {
  world: World
  teams: Record<ID, Team>
  agents: Record<ID, Agent>
  tasks: Task[]
  knowledge: KnowledgeNode[]
  edges: KnowledgeEdge[]
  tools: Record<ID, Tool>
  permissions: PermissionRule[]
  runtime: RuntimeSettings
  /** Per-team counters shown on department cards, keyed by team id. They start at 0 and grow as work completes. */
  metrics?: Record<ID, number[]>
}
