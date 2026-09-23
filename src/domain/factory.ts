import { TOOL_CATALOG, archetypeByKey, MODEL_OPTIONS } from './catalog'
import { hash01, uid } from './ids'
import type { AgentDefinition, OrgProposal, ProposedTeam } from './planner'
import type { AccessoryType, Agent, BuildingType, KnowledgeEdge, KnowledgeNode, Team, Tool, WorldBundle } from './types'

const ACCESSORIES: AccessoryType[] = ['antenna', 'headset', 'backpack', 'badge', 'cap', 'none']
const VISORS = ['#67e8f9', '#a5f3fc', '#bef264', '#fde68a', '#f0abfc', '#93c5fd']

export function makeAgent(
  worldId: string,
  team: Team,
  name: string,
  role: string,
  extra: Partial<Pick<Agent, 'goal' | 'successCriteria' | 'expectedOutput'>> & { instructions?: string; tools?: string[] } = {},
): Agent {
  const id = uid('agent')
  const a = archetypeByKey(team.buildingType === 'generic' ? 'generic' : (team.buildingType ?? 'generic'))
  const r = hash01(id)
  return {
    id,
    worldId,
    teamId: team.id,
    name,
    role,
    goal: extra.goal ?? role,
    successCriteria: extra.successCriteria,
    expectedOutput: extra.expectedOutput,
    appearance: {
      accent: team.color ?? a.color,
      visor: VISORS[Math.floor(r * VISORS.length)],
      accessory: r > 0.5 ? a.accessory : ACCESSORIES[Math.floor(hash01(id, 3) * ACCESSORIES.length)],
    },
    config: {
      model: MODEL_OPTIONS[0].id,
      instructions: extra.instructions ?? `You are ${name}. ${role}. Ask for approval before any external or irreversible action.`,
      tools: extra.tools ?? ['web-search'],
      memory: { world: true, team: true },
      temperature: 0.4,
      maxTokens: 4096,
      timeoutSec: 120,
      mcpServers: [],
    },
    tokensUsed: Math.floor(hash01(id, 7) * 4000),
    tasksCompleted: 0,
  }
}

export function makeTeam(worldId: string, p: Pick<ProposedTeam, 'name' | 'description' | 'color' | 'icon' | 'building'>): Team {
  return {
    id: uid('team'),
    worldId,
    name: p.name,
    description: p.description,
    color: p.color,
    icon: p.icon,
    agentIds: [],
    buildingType: p.building as BuildingType,
  }
}

export function agentFromDefinition(worldId: string, team: Team, def: AgentDefinition): Agent {
  return makeAgent(worldId, team, def.name, def.role, {
    goal: def.goal,
    successCriteria: def.successCriteria,
    expectedOutput: def.expectedOutput,
    instructions: def.instructions,
    tools: def.tools,
  })
}

export function bundleFromProposal(p: OrgProposal): WorldBundle {
  const worldId = uid('world')
  const now = new Date().toISOString()
  const teams: Record<string, Team> = {}
  const agents: Record<string, Agent> = {}
  for (const pt of p.teams.filter((t) => t.include)) {
    const team = makeTeam(worldId, pt)
    for (const pa of pt.agents.filter((a) => a.include)) {
      const agent = makeAgent(worldId, team, pa.name, pa.role, { tools: p.tools.slice(0, 3) })
      agents[agent.id] = agent
      team.agentIds.push(agent.id)
    }
    // Every team needs at least one agent to be visible and useful.
    if (team.agentIds.length === 0) {
      const agent = makeAgent(worldId, team, `${team.name} Agent`, team.description ?? 'Team member')
      agents[agent.id] = agent
      team.agentIds.push(agent.id)
    }
    teams[team.id] = team
  }
  const { knowledge, edges } = seedKnowledge(Object.values(teams))
  const tools: Record<string, Tool> = {}
  for (const tid of p.tools) {
    const t = TOOL_CATALOG.find((x) => x.id === tid)
    if (t) tools[t.id] = { ...t }
  }
  return {
    world: {
      id: worldId,
      name: p.name,
      description: p.description,
      icon: p.icon,
      goal: p.goal,
      teams: Object.keys(teams),
      agents: Object.keys(agents),
      tools: Object.keys(tools),
      createdAt: now,
      updatedAt: now,
    },
    teams,
    agents,
    tasks: [],
    knowledge,
    edges,
    tools,
    permissions: [
      { id: uid('perm'), teamId: '*', action: 'publish', mode: 'approval', source: 'Default: ask before publishing' },
      { id: uid('perm'), teamId: '*', action: 'spend', mode: 'approval', source: 'Default: ask before spending money' },
      { id: uid('perm'), teamId: '*', action: 'email', mode: 'approval', source: 'Default: ask before sending external email' },
    ],
    runtime: { eventSource: 'simulated', endpoint: '', autonomy: 0.6 },
  }
}

/** Seed worlds so the product is alive on first load. They are ordinary, editable data. */
export function seedProposals(): OrgProposal[] {
  const mk = (key: string, agentCount: number, name?: string): ProposedTeam => {
    const a = archetypeByKey(key)
    const agents = Array.from({ length: agentCount }, (_, i) => {
      const base = a.agents[i % a.agents.length]
      const n = i < a.agents.length ? base.name : `${a.label} Agent ${String(i + 1).padStart(2, '0')}`
      return { key: uid('pa'), name: n, role: base.role, include: true }
    })
    return { key: uid('pt'), name: name ?? a.label, description: a.description, archetype: a.key, color: a.color, icon: a.icon, building: a.building, include: true, agents }
  }
  return [
    {
      name: 'AI Worlds HQ',
      icon: '🚀',
      description: 'A SaaS startup operated by AI teams.',
      goal: 'Launch v1 and reach 1,000 paying customers.',
      teams: [mk('strategy', 2), mk('research', 4), mk('data', 3), mk('design', 3), mk('operations', 3), mk('marketing', 4), mk('product', 3)],
      tools: ['web-search', 'browser', 'database', 'slack', 'github'],
    },
    {
      name: 'Personal Finance YouTube',
      icon: '▶️',
      description: 'I want to build a YouTube channel about personal finance.',
      goal: 'Publish two videos a week and grow to 50k subscribers.',
      teams: [mk('research', 2), mk('content', 3), mk('design', 2), mk('video', 2), mk('marketing', 3, 'Marketing')],
      tools: ['web-search', 'youtube', 'slack'],
    },
  ]
}

/** A small starting knowledge graph so the Brain is never empty. */
function seedKnowledge(teams: Team[]): { knowledge: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  const knowledge: KnowledgeNode[] = []
  const edges: KnowledgeEdge[] = []
  const now = Date.now() - 60_000
  for (const t of teams) {
    const a = archetypeByKey(t.buildingType === 'studio' ? 'content' : (t.buildingType ?? 'generic'))
    a.knowledge.slice(0, 2).forEach((label, i) => {
      const node = { id: uid('k'), label, departmentId: t.id, importance: 0.4 + hash01(label, i) * 0.5, createdAt: now }
      if (knowledge.length) {
        const prev = knowledge[Math.floor(hash01(node.id) * knowledge.length)]
        edges.push({ source: node.id, target: prev.id, strength: 0.5 })
      }
      if (i === 1) edges.push({ source: node.id, target: knowledge[knowledge.length - 1].id, strength: 0.8 })
      knowledge.push(node)
    })
  }
  return { knowledge, edges }
}
