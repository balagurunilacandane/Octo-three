import {
  ARCHETYPES,
  GENERIC_ARCHETYPE,
  SENSITIVE_ACTIONS,
  WORLD_TEMPLATES,
  archetypeByKey,
  colorForName,
  matchArchetype,
  type TeamArchetype,
} from './catalog'
import type { BuildingType, PermissionRule, Team, WorldBundle } from './types'
import { uid } from './ids'

// ─────────────────────────────────────────────────────────────────────────────
// The planner turns natural language into organisation structure.
// `localPlanner` is a deterministic, offline heuristic implementation so the
// product works without any API key. A model-backed planner can implement the
// same `OrgPlanner` interface and be swapped in without touching the UI.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposedAgent {
  key: string
  name: string
  role: string
  include: boolean
}

export interface ProposedTeam {
  key: string
  name: string
  description: string
  archetype: string
  color: string
  icon: string
  building: BuildingType
  include: boolean
  agents: ProposedAgent[]
}

export interface OrgProposal {
  name: string
  icon: string
  description: string
  goal: string
  teams: ProposedTeam[]
  tools: string[]
}

export interface AgentDefinition {
  name: string
  role: string
  instructions: string
  goal: string
  tools: string[]
  expectedOutput: string
  successCriteria: string
}

export interface PlannedStep {
  teamId: string
  title: string
}

export interface RequestPlan {
  title: string
  steps: PlannedStep[]
  approval?: { action: string; reason: string }
  explanation: string
}

export interface OrgPlanner {
  proposeOrganization(description: string, templateKey?: string): Promise<OrgProposal>
  proposeTeam(name: string, description: string): Promise<ProposedTeam>
  defineAgent(whatItDoes: string, success: string, teamName?: string): Promise<AgentDefinition>
  planRequest(text: string, bundle: WorldBundle): Promise<RequestPlan>
  parsePolicy(text: string, bundle: WorldBundle): Promise<PermissionRule[]>
}

// ─── helpers ────────────────────────────────────────────────────────────────

const STOP = new Set(['i', 'want', 'to', 'a', 'an', 'the', 'my', 'our', 'we', 'build', 'start', 'create', 'launch', 'run', 'make', 'manage', 'new', 'for', 'of', 'and', 'with', 'that', 'is', 'would', 'like', 'about', 'on', 'in'])

export function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/[A-Z]/.test(w.slice(1)) || (w.length <= 3 && w === w.toUpperCase()) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

const PRODUCT_NOUNS: [RegExp, string][] = [
  [/youtube/i, 'YouTube'],
  [/podcast/i, 'Podcast'],
  [/newsletter/i, 'Newsletter'],
  [/mobile app|\bapp\b/i, 'App'],
  [/saas/i, 'SaaS'],
  [/agency/i, 'Agency'],
  [/brand/i, 'Brand'],
  [/platform/i, 'Platform'],
  [/store|shop|e-?commerce/i, 'Store'],
  [/channel/i, 'Channel'],
  [/startup/i, 'Startup'],
]

export function deriveWorldName(description: string): string {
  return fixBrandCase(deriveName(description))
}

function fixBrandCase(s: string) {
  return s.replace(/\byoutube\b/gi, 'YouTube').replace(/\bsaas\b/gi, 'SaaS').replace(/\bai\b/gi, 'AI').replace(/\btiktok\b/gi, 'TikTok')
}

function deriveName(description: string): string {
  const d = description.trim().replace(/[.!?]+$/, '')
  const noun = PRODUCT_NOUNS.find(([re]) => re.test(d))?.[1]
  const about = d.match(/\b(?:about|on|for)\s+([a-z0-9 \-']{3,40})/i)
  if (about) {
    const topic = about[1].split(/\s+/).filter((w) => !STOP.has(w.toLowerCase())).slice(0, 3).join(' ')
    if (topic) return titleCase(noun ? `${topic} ${noun}` : topic)
  }
  const words = d.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()))
  const name = titleCase(words.slice(0, 4).join(' '))
  return name || 'New World'
}

const ICONS: [RegExp, string][] = [
  [/youtube|video|channel/i, '▶️'],
  [/podcast|audio/i, '🎙'],
  [/exam|education|course|student|learn/i, '📚'],
  [/finance|money|invest/i, '💰'],
  [/cloth|fashion|brand/i, '👕'],
  [/shop|store|commerce/i, '🛒'],
  [/marketing|agency/i, '📣'],
  [/research|study/i, '🔬'],
  [/app|mobile/i, '📱'],
  [/saas|startup|software/i, '🚀'],
]

const DOMAIN_TEAMS: [RegExp, string[]][] = [
  [/youtube|video channel|vlog/i, ['research', 'content', 'design', 'video', 'marketing']],
  [/podcast/i, ['research', 'content', 'video', 'design', 'marketing']],
  [/exam|education|course|student|learn/i, ['research', 'content', 'product', 'engineering', 'marketing']],
  [/cloth|fashion|e-?commerce|shop|store|brand/i, ['strategy', 'research', 'design', 'product', 'marketing', 'operations']],
  [/saas|software|startup/i, ['strategy', 'research', 'engineering', 'product', 'design', 'marketing']],
  [/mobile app|\bapp\b|platform/i, ['research', 'product', 'design', 'engineering', 'marketing']],
  [/agency/i, ['strategy', 'design', 'content', 'marketing', 'operations']],
  [/marketing|growth/i, ['strategy', 'research', 'content', 'marketing', 'data']],
  [/research|study|thesis|topic/i, ['research', 'data', 'content', 'strategy']],
]

function teamFromArchetype(a: TeamArchetype, nameOverride?: string): ProposedTeam {
  const name = nameOverride ?? a.label
  return {
    key: uid('pt'),
    name,
    description: a.description,
    archetype: a.key,
    color: a === GENERIC_ARCHETYPE ? colorForName(name) : a.color,
    icon: a.icon,
    building: a.building,
    include: true,
    agents: a.agents.map((ag, i) => ({ key: uid('pa'), name: ag.name, role: ag.role, include: i < 2 || a.agents.length <= 2 })),
  }
}

function suggestTools(teamKeys: string[], description: string): string[] {
  const tools = new Set<string>(['web-search'])
  if (teamKeys.includes('research')) tools.add('browser')
  if (teamKeys.includes('data')) tools.add('database')
  if (teamKeys.includes('engineering')) tools.add('github')
  if (/youtube|video/i.test(description)) tools.add('youtube')
  if (/shop|store|commerce|cloth/i.test(description)) tools.add('shopify')
  tools.add('slack')
  return [...tools]
}

// ─── local heuristic planner ────────────────────────────────────────────────

export const localPlanner: OrgPlanner = {
  async proposeOrganization(description, templateKey) {
    const template = WORLD_TEMPLATES.find((t) => t.key === templateKey)
    const text = description || template?.prompt || ''
    let keys = template?.teams.slice() ?? DOMAIN_TEAMS.find(([re]) => re.test(text))?.[1].slice()
    if (!keys) keys = ['strategy', 'research', 'operations', 'marketing']
    // Add teams explicitly mentioned in the description.
    const lower = text.toLowerCase()
    for (const a of ARCHETYPES) {
      if (keys.length >= 8) break
      if (!keys.includes(a.key) && (lower.includes(a.label.toLowerCase()) || lower.includes(a.key))) keys.push(a.key)
    }
    const analyticsName = /analytic/i.test(text) ? 'Analytics' : undefined
    if (analyticsName && !keys.includes('data')) keys.push('data')
    const teams = keys.slice(0, 8).map((k) => teamFromArchetype(archetypeByKey(k), k === 'data' ? analyticsName : undefined))
    const name = template && !description ? template.label.replace(/^(Start|Build|Run|Research|Create|Manage) (a|an) /i, '') : deriveWorldName(text)
    const icon = template?.icon ?? ICONS.find(([re]) => re.test(text))?.[1] ?? '🌐'
    return {
      name: titleCase(name),
      icon,
      description: text,
      goal: '',
      teams,
      tools: suggestTools(keys, text),
    }
  },

  async proposeTeam(name, description) {
    const a = matchArchetype(`${name} ${description}`)
    const t = teamFromArchetype(a, name || a.label)
    if (description) t.description = description
    if (a === GENERIC_ARCHETYPE) {
      const base = titleCase(name.replace(/team$/i, '').trim() || 'Team')
      t.agents = [
        { key: uid('pa'), name: `${base} Lead`, role: `Leads ${base.toLowerCase()} work`, include: true },
        { key: uid('pa'), name: `${base} Specialist`, role: description || `Handles ${base.toLowerCase()} tasks`, include: true },
        { key: uid('pa'), name: `${base} Assistant`, role: 'Prepares summaries and follow-ups', include: false },
      ]
    } else {
      t.agents.forEach((ag) => (ag.include = true))
    }
    return t
  },

  async defineAgent(whatItDoes, success, teamName) {
    const a = matchArchetype(`${whatItDoes} ${teamName ?? ''}`)
    const verb = whatItDoes.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    const roleWord: Record<string, string> = {
      research: 'Researcher', analyze: 'Analyst', analyse: 'Analyst', write: 'Writer', design: 'Designer',
      create: 'Creator', build: 'Builder', monitor: 'Monitor', edit: 'Editor', plan: 'Planner', test: 'Tester', summarize: 'Summarizer',
    }
    const topic = whatItDoes.split(/\s+/).slice(1, 3).filter((w) => !STOP.has(w.toLowerCase())).join(' ')
    const name = titleCase(`${topic || a.label} ${roleWord[verb] ?? 'Agent'}`)
    const tools = new Set<string>()
    if (/research|search|find|competitor|source/i.test(whatItDoes)) tools.add('web-search').add('browser')
    if (/data|metric|report|dashboard/i.test(whatItDoes)) tools.add('database')
    if (/code|bug|pull request|github/i.test(whatItDoes)) tools.add('github')
    if (/email|outreach/i.test(whatItDoes)) tools.add('email')
    if (/post|message|slack|team/i.test(whatItDoes)) tools.add('slack')
    if (tools.size === 0) tools.add('web-search')
    return {
      name,
      role: whatItDoes.trim(),
      goal: whatItDoes.trim(),
      instructions:
        `You are ${name}, part of the ${teamName ?? a.label} team.\n` +
        `Your job: ${whatItDoes.trim()}.\n` +
        (success ? `A great result looks like: ${success.trim()}.\n` : '') +
        'Work step by step, cite sources where relevant, and ask for approval before any external or irreversible action.',
      tools: [...tools],
      expectedOutput: success.trim() || 'A concise written summary of the work.',
      successCriteria: success.trim() || 'The requester can act on the result without follow-up questions.',
    }
  },

  async planRequest(text, bundle) {
    const teams = Object.values(bundle.teams)
    const lower = text.toLowerCase()
    // Score teams by keyword relevance and position in the sentence to order the steps.
    const scored = teams
      .map((t) => {
        const a = archetypeByKey(teamArchetypeKey(t))
        let pos = Infinity
        let score = 0
        const words = [t.name.toLowerCase(), ...a.keywords]
        for (const k of words) {
          const idx = lower.indexOf(k)
          if (idx >= 0) {
            score += k.length > 5 ? 2 : 1
            pos = Math.min(pos, idx)
          }
        }
        return { team: t, score, pos }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => a.pos - b.pos)

    let chosen = scored.slice(0, 3).map((s) => s.team)
    if (chosen.length === 0) {
      // Nothing matched: route through the most general teams available.
      const pref = ['research', 'strategy', 'operations', 'content', 'product']
      const fallback = teams.find((t) => pref.includes(teamArchetypeKey(t))) ?? teams[0]
      chosen = fallback ? [fallback] : []
    }
    const clean = text.trim().replace(/[.!]+$/, '')
    const parts = clean.split(/\s+(?:and then|then|and)\s+/i).filter(Boolean)
    const steps: PlannedStep[] = chosen.map((t, i) => ({
      teamId: t.id,
      title: titleCaseFirst(parts[Math.min(i, parts.length - 1)] ?? clean),
    }))
    const sensitive = SENSITIVE_ACTIONS.find((s) => s.keywords.some((k) => lower.includes(k)))
    let approval: RequestPlan['approval']
    if (sensitive) {
      const last = chosen[chosen.length - 1]
      const rule = bundle.permissions.find((p) => p.action === sensitive.action && (p.teamId === '*' || p.teamId === last?.id))
      if (!rule || rule.mode === 'approval') approval = { action: sensitive.action, reason: sensitive.label }
    }
    return {
      title: titleCaseFirst(clean),
      steps,
      approval,
      explanation:
        `Routing to ${chosen.map((t) => t.name).join(' → ')}` + (approval ? ` · "${approval.reason}" will wait for your approval` : ''),
    }
  },

  async parsePolicy(text, bundle) {
    const lower = text.toLowerCase()
    const teams = Object.values(bundle.teams)
    const team = teams.find((t) => lower.includes(t.name.toLowerCase()))
    const teamId = team?.id ?? '*'
    const rules: PermissionRule[] = []
    // Split into "allowed" clause and "ask me" clause.
    const askIdx = lower.search(/ask me|approval|approve|check with me|confirm/)
    for (const s of SENSITIVE_ACTIONS) {
      const idx = s.keywords.map((k) => lower.indexOf(k)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
      if (idx === undefined) continue
      const needsApproval = askIdx >= 0 && (idx > askIdx - 30 || /never|don't|do not/.test(lower))
      rules.push({ id: uid('perm'), teamId, action: s.action, mode: needsApproval ? 'approval' : 'auto', source: text })
    }
    if (/create|draft|write|post/.test(lower) && !rules.some((r) => r.action === 'create')) {
      rules.push({ id: uid('perm'), teamId, action: 'create', mode: 'auto', source: text })
    }
    return rules
  },
}

function titleCaseFirst(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

export function teamArchetypeKey(t: Pick<Team, 'name' | 'description' | 'buildingType'>): string {
  const a = matchArchetype(`${t.name} ${t.description ?? ''}`)
  if (a !== GENERIC_ARCHETYPE) return a.key
  return t.buildingType && t.buildingType !== 'generic' && t.buildingType !== 'studio' ? t.buildingType : 'generic'
}

export function archetypeForTeam(t: Pick<Team, 'name' | 'description' | 'buildingType'>): TeamArchetype {
  return archetypeByKey(teamArchetypeKey(t))
}
