import { interactionGroups, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { AgentBody } from '../sim/WorldRuntime'

// Selective physics for agents: each agent is a kinematic capsule moved by a
// Rapier character controller, so it slides along buildings, desks and walls
// instead of passing through them. Agents don't collide with each other (they
// are on their own collision group) — navigation keeps them apart.

export const AGENT_CAPSULE = { halfHeight: 0.22, radius: 0.26, centerY: 0.5 }
export const AGENT_GROUPS = interactionGroups(1, [0])
export const ENV_GROUPS = interactionGroups(0, [0, 1])

export function useCharacterController() {
  const { world } = useRapier()
  const controller = useMemo(() => {
    const c = world.createCharacterController(0.02)
    c.setSlideEnabled(true)
    c.setApplyImpulsesToDynamicBodies(false)
    return c
  }, [world])
  useEffect(() => () => world.removeCharacterController(controller), [world, controller])
  return controller
}

export function makeAgentBody(
  controller: ReturnType<typeof useCharacterController>,
  body: RapierRigidBody,
  collider: RapierCollider,
  groundY: () => number,
): AgentBody {
  const out = new THREE.Vector3()
  return {
    move(desired) {
      try {
        controller.computeColliderMovement(collider, { x: desired.x, y: 0, z: desired.z }, undefined, AGENT_GROUPS)
        const m = controller.computedMovement()
        const t = body.translation()
        body.setNextKinematicTranslation({ x: t.x + m.x, y: groundY() + AGENT_CAPSULE.centerY, z: t.z + m.z })
        return out.set(m.x, 0, m.z)
      } catch {
        return out.copy(desired)
      }
    },
    teleport(p) {
      body.setNextKinematicTranslation({ x: p.x, y: p.y + AGENT_CAPSULE.centerY, z: p.z })
    },
  }
}
