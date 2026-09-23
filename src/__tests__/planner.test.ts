import { describe, expect, it } from 'vitest'
import { bundleFromProposal } from '../domain/factory'
import { deriveWorldName, localPlanner } from '../domain/planner'

describe('natural-language world creation', () => {
  it('turns a YouTube description into a content organisation', async () => {
    const p = await localPlanner.proposeOrganization('I want to build a YouTube channel about personal finance.')
    expect(p.name).toBe('Personal Finance YouTube')
    expect(p.teams.map((t) => t.name)).toEqual(['Research', 'Content', 'Design', 'Video', 'Marketing'])
    expect(p.tools).toContain('youtube')
  })

  it('keeps brand casing in derived names', () => {
    expect(deriveWorldName('I want to build a youtube channel')).toBe('YouTube Channel')
  })

  it('maps custom teams to the generic building with a generated identity', async () => {
    const t = await localPlanner.proposeTeam('Wedding Planning', 'Plan venues and vendors')
    expect(t.building).toBe('operations') // "planning event"/"wedding" keywords → operations archetype
    const g = await localPlanner.proposeTeam('Grant Hunting', '')
    expect(['research', 'generic']).toContain(g.building)
    expect(g.agents.length).toBeGreaterThan(0)
  })

  it('routes a request across teams and flags actions that need approval', async () => {
    const b = bundleFromProposal(await localPlanner.proposeOrganization('I want to start a SaaS business.'))
    const plan = await localPlanner.planRequest('Research the top 20 competitors and publish a comparison on social.', b)
    const names = plan.steps.map((s) => b.teams[s.teamId].name)
    expect(names[0]).toBe('Research')
    expect(names).toContain('Marketing')
    expect(plan.approval?.action).toBe('publish')
  })

  it('translates a plain-language policy into permission rules', async () => {
    const b = bundleFromProposal(await localPlanner.proposeOrganization('I want to run a marketing team.'))
    const rules = await localPlanner.parsePolicy('Let the marketing team create posts, but ask me before publishing.', b)
    const marketing = Object.values(b.teams).find((t) => t.name === 'Marketing')!
    expect(rules.find((r) => r.action === 'publish')).toMatchObject({ mode: 'approval', teamId: marketing.id })
    expect(rules.find((r) => r.action === 'create')).toMatchObject({ mode: 'auto' })
  })

  it('keeps every entity inside its own world', async () => {
    const a = bundleFromProposal(await localPlanner.proposeOrganization('I want to build a mobile app.'))
    const b = bundleFromProposal(await localPlanner.proposeOrganization('I want to build a podcast.'))
    for (const bundle of [a, b]) {
      for (const t of Object.values(bundle.teams)) expect(t.worldId).toBe(bundle.world.id)
      for (const ag of Object.values(bundle.agents)) expect(ag.worldId).toBe(bundle.world.id)
    }
    expect(a.world.id).not.toBe(b.world.id)
  })
})
