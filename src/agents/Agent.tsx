import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { AccessoryType, Agent as AgentModel } from '../domain/types'
import { useWorld } from '../state/worldStore'
import { G, PALETTE, mutedAccent } from '../world/materials'
import { useRuntime } from '../world/RuntimeContext'
import { animateAgent, createPose, type AgentPose } from './AgentAnimator'
import { AGENT_CAPSULE, AGENT_GROUPS, makeAgentBody, type useCharacterController } from './AgentPhysics'

// ─────────────────────────────────────────────────────────────────────────────
// Instanced agent renderer. Every agent shares one articulated robot rig; each
// body part is a single InstancedMesh across *all* agents, so 10 or 200 agents
// cost the same ~25 draw calls. Per-agent identity comes from instance colours
// (team accent, visor) and accessory parts that are scaled to zero when absent.
// ─────────────────────────────────────────────────────────────────────────────

type Bone = 'root' | 'hips' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'
type ColorMode = 'fixed' | 'accent' | 'accentGlow' | 'visor' | 'indicator' | 'burst'
type Special = 'indicator' | 'task' | 'thought0' | 'thought1' | 'thought2' | 'burst' | 'shadow'

interface PartDef {
  bone: Bone
  geometry: THREE.BufferGeometry
  material: THREE.Material
  color: ColorMode
  pos: [number, number, number]
  rot?: [number, number, number]
  scale: [number, number, number]
  accessory?: AccessoryType
  special?: Special
  castShadow?: boolean
}

const torsoGeo = new RoundedBoxGeometry(0.4, 0.38, 0.3, 3, 0.12)
const packGeo = new RoundedBoxGeometry(0.3, 0.3, 0.14, 2, 0.05)

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grd.addColorStop(0, '#ffffff')
  grd.addColorStop(1, '#000000')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function buildParts(): PartDef[] {
  const white = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.1 })
  const shell = new THREE.MeshStandardMaterial({ color: '#56565c', roughness: 0.5, metalness: 0.15 })
  const joint = new THREE.MeshStandardMaterial({ color: '#3b3b40', roughness: 0.6, metalness: 0.2 })
  const head = new THREE.MeshStandardMaterial({ color: PALETTE.head, roughness: 0.3, metalness: 0.35 })
  const dark = new THREE.MeshStandardMaterial({ color: PALETTE.dark, roughness: 0.55, metalness: 0.15 })
  const glow = () => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  const shadow = new THREE.MeshBasicMaterial({ color: '#1b0930', transparent: true, opacity: 0.35, depthWrite: false, alphaMap: shadowTexture() })
  const burst = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
  const HALF_PI = Math.PI / 2
  const accentMat = white()
  return [
    { bone: 'root', geometry: G.plane, material: shadow, color: 'fixed', pos: [0, 0.012, 0], rot: [-HALF_PI, 0, 0], scale: [0.62, 0.62, 0.62], special: 'shadow' },
    { bone: 'root', geometry: G.ring, material: burst, color: 'burst', pos: [0, 0.03, 0], rot: [-HALF_PI, 0, 0], scale: [1, 1, 1], special: 'burst' },
    // legs
    { bone: 'legL', geometry: G.capsule, material: joint, color: 'fixed', pos: [0, -0.13, 0], scale: [0.13, 0.19, 0.13], castShadow: true },
    { bone: 'legR', geometry: G.capsule, material: joint, color: 'fixed', pos: [0, -0.13, 0], scale: [0.13, 0.19, 0.13], castShadow: true },
    { bone: 'legL', geometry: G.box, material: accentMat, color: 'accent', pos: [0, -0.27, 0.03], scale: [0.13, 0.06, 0.18] },
    { bone: 'legR', geometry: G.box, material: accentMat, color: 'accent', pos: [0, -0.27, 0.03], scale: [0.13, 0.06, 0.18] },
    // torso
    { bone: 'hips', geometry: torsoGeo, material: shell, color: 'fixed', pos: [0, 0.5, 0], scale: [1, 1, 1], castShadow: true },
    { bone: 'hips', geometry: G.box, material: accentMat, color: 'accent', pos: [0, 0.36, 0], scale: [0.41, 0.06, 0.31] },
    { bone: 'hips', geometry: G.box, material: glow(), color: 'accentGlow', pos: [0, 0.53, 0.155], scale: [0.12, 0.08, 0.02] },
    { bone: 'hips', geometry: packGeo, material: accentMat, color: 'accent', pos: [0, 0.52, -0.2], scale: [1, 1, 1], accessory: 'backpack', castShadow: true },
    { bone: 'hips', geometry: G.cyl, material: glow(), color: 'fixed', pos: [0.12, 0.6, 0.156], rot: [HALF_PI, 0, 0], scale: [0.05, 0.02, 0.05], accessory: 'badge' },
    // arms
    { bone: 'armL', geometry: G.capsule, material: shell, color: 'fixed', pos: [0, -0.13, 0], scale: [0.1, 0.17, 0.1], castShadow: true },
    { bone: 'armR', geometry: G.capsule, material: shell, color: 'fixed', pos: [0, -0.13, 0], scale: [0.1, 0.17, 0.1], castShadow: true },
    { bone: 'armL', geometry: G.sphereLo, material: accentMat, color: 'accent', pos: [0, -0.27, 0], scale: [0.065, 0.065, 0.065] },
    { bone: 'armR', geometry: G.sphereLo, material: accentMat, color: 'accent', pos: [0, -0.27, 0], scale: [0.065, 0.065, 0.065] },
    // head
    { bone: 'head', geometry: G.sphere, material: head, color: 'fixed', pos: [0, 0, 0], scale: [0.26, 0.24, 0.25], castShadow: true },
    { bone: 'head', geometry: G.sphere, material: glow(), color: 'visor', pos: [0, 0, 0.17], scale: [0.19, 0.1, 0.1] },
    { bone: 'head', geometry: G.torus, material: accentMat, color: 'accent', pos: [0, -0.02, 0], rot: [HALF_PI, 0, 0], scale: [0.262, 0.242, 0.4] },
    { bone: 'head', geometry: G.cylLo, material: joint, color: 'fixed', pos: [0, 0.31, 0], scale: [0.015, 0.16, 0.015], accessory: 'antenna' },
    { bone: 'head', geometry: G.sphereLo, material: glow(), color: 'accentGlow', pos: [0, 0.41, 0], scale: [0.04, 0.04, 0.04], accessory: 'antenna' },
    { bone: 'head', geometry: G.torus, material: dark, color: 'fixed', pos: [0, 0.02, 0], rot: [0, HALF_PI, 0], scale: [0.27, 0.27, 0.6], accessory: 'headset' },
    { bone: 'head', geometry: G.cyl, material: accentMat, color: 'accent', pos: [-0.26, -0.02, 0], rot: [0, 0, HALF_PI], scale: [0.07, 0.05, 0.07], accessory: 'headset' },
    { bone: 'head', geometry: G.cyl, material: accentMat, color: 'accent', pos: [0.26, -0.02, 0], rot: [0, 0, HALF_PI], scale: [0.07, 0.05, 0.07], accessory: 'headset' },
    { bone: 'head', geometry: G.sphere, material: accentMat, color: 'accent', pos: [0, 0.1, -0.01], scale: [0.25, 0.14, 0.25], accessory: 'cap' },
    { bone: 'head', geometry: G.cyl, material: accentMat, color: 'accent', pos: [0, 0.13, 0.17], scale: [0.16, 0.02, 0.14], accessory: 'cap' },
    // status
    { bone: 'root', geometry: G.sphereLo, material: glow(), color: 'indicator', pos: [0, 0, 0], scale: [1, 1, 1], special: 'indicator' },
    { bone: 'root', geometry: G.octa, material: new THREE.MeshBasicMaterial({ color: new THREE.Color('#d9c27a'), toneMapped: false }), color: 'fixed', pos: [0, 0, 0], scale: [0.07, 0.1, 0.07], special: 'task' },
    ...([0, 1, 2] as const).map(
      (i): PartDef => ({ bone: 'root', geometry: G.sphereLo, material: new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfc8e0'), toneMapped: false }), color: 'fixed', pos: [0, 0, 0], scale: [1, 1, 1], special: `thought${i}` }),
    ),
  ]
}

const m4 = new THREE.Matrix4()
const tmpM = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const sv = new THREE.Vector3()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const WHITE = new THREE.Color('#ffffff')

function compose(pos: [number, number, number], rot: [number, number, number] | undefined, scale: [number, number, number], out: THREE.Matrix4) {
  e.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0)
  q.setFromEuler(e)
  return out.compose(v.set(...pos), q, sv.set(...scale))
}

interface Slot {
  id: string
  accent: THREE.Color
  accentGlow: THREE.Color
  visor: THREE.Color
  accessory: AccessoryType
  pose: AgentPose
}

function AgentInstancesImpl({ agents }: { agents: AgentModel[] }) {
  const { runtime } = useRuntime()
  const setHover = useWorld((s) => s.setHover)
  const selectAgent = useWorld((s) => s.selectAgent)
  const parts = useMemo(buildParts, [])
  const partLocal = useMemo(() => parts.map((p) => compose(p.pos, p.rot, p.scale, new THREE.Matrix4())), [parts])
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const hit = useRef<THREE.InstancedMesh>(null)
  const count = agents.length

  const slots = useMemo<Slot[]>(
    () =>
      agents.map((a) => ({
        id: a.id,
        accent: new THREE.Color(mutedAccent(a.appearance.accent)),
        accentGlow: new THREE.Color(mutedAccent(a.appearance.accent)).multiplyScalar(1.1),
        visor: new THREE.Color(mutedAccent(a.appearance.visor)).lerp(new THREE.Color('#ffffff'), 0.3),
        accessory: a.appearance.accessory,
        pose: createPose(),
      })),
    [agents],
  )

  // Static per-instance colours.
  useEffect(() => {
    parts.forEach((p, pi) => {
      const mesh = meshes.current[pi]
      if (!mesh) return
      if (p.color === 'accent' || p.color === 'accentGlow') {
        slots.forEach((s, i) => mesh.setColorAt(i, p.color === 'accent' ? s.accent : s.accentGlow))
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      } else if (p.color !== 'fixed') {
        slots.forEach((_, i) => mesh.setColorAt(i, WHITE))
      }
    })
  }, [parts, slots])

  const bones: Record<Bone, THREE.Matrix4> = useMemo(
    () => ({ root: new THREE.Matrix4(), hips: new THREE.Matrix4(), head: new THREE.Matrix4(), armL: new THREE.Matrix4(), armR: new THREE.Matrix4(), legL: new THREE.Matrix4(), legR: new THREE.Matrix4() }),
    [],
  )

  useFrame(() => {
    const t = runtime.time
    slots.forEach((s, i) => {
      const a = runtime.agents.get(s.id)
      if (!a) return
      const p = s.pose
      animateAgent(p, a, t, s.visor)

      // skeleton
      bones.root.compose(a.pos, q.setFromEuler(e.set(0, a.heading, 0)), sv.set(1, 1, 1))
      bones.hips.copy(bones.root).multiply(tmpM.compose(v.set(0, p.hipsY, 0), q.identity(), sv.set(1, p.breathe, 1)))
      bones.head.copy(bones.hips).multiply(tmpM.compose(v.set(0, 0.9, 0), q.setFromEuler(e.set(p.headX, p.headY, p.headZ)), sv.set(1, 1 / p.breathe, 1)))
      bones.armL.copy(bones.hips).multiply(tmpM.compose(v.set(-0.25, 0.64, 0), q.setFromEuler(e.set(p.armLx, 0, p.armLz)), sv.set(1, 1, 1)))
      bones.armR.copy(bones.hips).multiply(tmpM.compose(v.set(0.25, 0.64, 0), q.setFromEuler(e.set(p.armRx, 0, p.armRz)), sv.set(1, 1, 1)))
      bones.legL.copy(bones.root).multiply(tmpM.compose(v.set(-0.09, 0.3 + p.hipsY * 0.6, 0), q.setFromEuler(e.set(p.legL, 0, 0)), sv.set(1, 1, 1)))
      bones.legR.copy(bones.root).multiply(tmpM.compose(v.set(0.09, 0.3 + p.hipsY * 0.6, 0), q.setFromEuler(e.set(p.legR, 0, 0)), sv.set(1, 1, 1)))

      parts.forEach((part, pi) => {
        const mesh = meshes.current[pi]
        if (!mesh) return
        if (part.accessory && part.accessory !== s.accessory) {
          mesh.setMatrixAt(i, ZERO)
          return
        }
        switch (part.special) {
          case 'indicator':
            if (!p.indicator) mesh.setMatrixAt(i, ZERO)
            else {
              m4.compose(v.set(a.pos.x, a.pos.y + p.indicatorY + p.hipsY, a.pos.z), q.identity(), sv.setScalar(p.indicator))
              mesh.setMatrixAt(i, m4)
              mesh.setColorAt(i, p.indicatorColor)
            }
            return
          case 'task':
            if (!p.task) mesh.setMatrixAt(i, ZERO)
            else mesh.setMatrixAt(i, m4.compose(v.set(a.pos.x, a.pos.y + p.taskY + p.hipsY, a.pos.z), q.setFromEuler(e.set(0, p.task, 0)), sv.set(0.07, 0.1, 0.07)))
            return
          case 'thought0':
          case 'thought1':
          case 'thought2': {
            if (!p.thought) {
              mesh.setMatrixAt(i, ZERO)
              return
            }
            const k = (p.thought * 0.7 + Number(part.special.slice(-1)) / 3) % 1
            tmpM.compose(v.set(0.18 + k * 0.1, 1.1 + k * 0.45, 0), q.identity(), sv.setScalar(0.03 + k * 0.05))
            mesh.setMatrixAt(i, m4.copy(bones.root).multiply(tmpM))
            return
          }
          case 'burst':
            if (p.burst < 0.01) mesh.setMatrixAt(i, ZERO)
            else {
              const k = 1 - p.burst
              tmpM.compose(v.set(0, 0.03, 0), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), sv.setScalar(0.3 + k * 1.4))
              mesh.setMatrixAt(i, m4.copy(bones.root).multiply(tmpM))
              mesh.setColorAt(i, p.burstColor)
            }
            return
        }
        mesh.setMatrixAt(i, m4.copy(bones[part.bone]).multiply(partLocal[pi]))
        if (part.color === 'visor') mesh.setColorAt(i, p.visor)
      })

      // hit proxy for hover / click
      hit.current?.setMatrixAt(i, m4.compose(v.set(a.pos.x, a.pos.y + 0.65, a.pos.z), q.identity(), sv.set(0.36, 0.7, 0.36)))
    })
    for (let pi = 0; pi < parts.length; pi++) {
      const mesh = meshes.current[pi]
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor && parts[pi].color !== 'fixed' && parts[pi].color !== 'accent' && parts[pi].color !== 'accentGlow') mesh.instanceColor.needsUpdate = true
    }
    if (hit.current) {
      hit.current.instanceMatrix.needsUpdate = true
      hit.current.computeBoundingSphere()
    }
  })

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId !== undefined ? slots[e.instanceId]?.id : undefined)

  if (!count) return null
  return (
    <group>
      {parts.map((p, pi) => (
        <instancedMesh
          key={`${pi}-${count}`}
          ref={(m) => {
            meshes.current[pi] = m
          }}
          args={[p.geometry, p.material, count]}
          castShadow={!!p.castShadow}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}
      <instancedMesh
        key={`hit-${count}`}
        ref={hit}
        args={[G.sphereLo, undefined, count]}
        onPointerMove={(ev) => {
          ev.stopPropagation()
          const id = idAt(ev)
          if (id) {
            setHover({ kind: 'agent', id })
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(ev) => {
          ev.stopPropagation()
          const id = idAt(ev)
          if (id && ev.delta < 6) selectAgent(id)
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  )
}

export const AgentInstances = memo(AgentInstancesImpl)

type Controller = ReturnType<typeof useCharacterController>

/** Kinematic capsule for one agent (no visuals) — physics only. */
function AgentBodyImpl({ agentId, controller }: { agentId: string; controller: Controller }) {
  const { runtime } = useRuntime()
  const rt = runtime.agents.get(agentId)
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)

  useEffect(() => {
    if (!rt) return
    let raf = 0
    const attach = () => {
      if (body.current && collider.current) rt.body = makeAgentBody(controller, body.current, collider.current, () => rt.pos.y)
      else raf = requestAnimationFrame(attach)
    }
    attach()
    return () => {
      cancelAnimationFrame(raf)
      rt.body = null
    }
  }, [rt, controller])

  if (!rt) return null
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[rt.pos.x, rt.pos.y + AGENT_CAPSULE.centerY, rt.pos.z]}>
      <CapsuleCollider ref={collider} args={[AGENT_CAPSULE.halfHeight, AGENT_CAPSULE.radius]} collisionGroups={AGENT_GROUPS} />
    </RigidBody>
  )
}

export const AgentBody = memo(AgentBodyImpl)
