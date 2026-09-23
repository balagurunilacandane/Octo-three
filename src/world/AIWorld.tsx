import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { AgentBody, AgentInstances } from '../agents/Agent'
import { useCharacterController } from '../agents/AgentPhysics'
import { WorldCamera } from '../camera/WorldCamera'
import { connectRealtime, type ConnectionStatus } from '../events/realtime'
import { createScreenMaterial } from '../shaders/screenMaterial'
import { Director } from '../sim/Director'
import { WorldRuntime } from '../sim/WorldRuntime'
import { useWorld } from '../state/worldStore'
import { TaskParticles } from '../tasks/TaskParticle'
import { registerWorld } from '../tasks/TaskSystem'
import { Brain } from './Brain'
import { DataPaths } from './DataPath'
import { Department } from './Department'
import { generateLayout, layoutKey, type WorldLayout } from './layout'
import { animatedNeon, windUniform } from './materials'
import { detectQuality, type QualitySettings } from './quality'
import { RuntimeContext, type RuntimeContextValue, type TeamVisuals } from './RuntimeContext'
import { WorldColliders, WorldPlatform } from './WorldPlatform'

/** One frame loop for the whole simulation: runtime → team visuals. */
function SimulationLoop({ ctx }: { ctx: RuntimeContextValue }) {
  useFrame((_, dt) => {
    ctx.runtime.update(dt)
    windUniform.value += dt
    for (const [teamId, v] of Object.entries(ctx.teamVisuals)) {
      const act = ctx.runtime.activityOf(teamId)
      for (const s of v.screens) {
        s.uniforms.uTime.value += dt
        s.uniforms.uActivity.value = act
      }
      v.glow.emissiveIntensity = 0.5 + act * 2.6
    }
  }, -1)
  return null
}

/** `?debug` exposes renderer stats + runtime on window.__aiworld for profiling. */
function DebugHook({ runtime }: { runtime: WorldRuntime }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('debug')) return
    ;(window as unknown as { __aiworld: unknown }).__aiworld = { gl, scene, runtime }
  }, [gl, scene, runtime])
  return null
}

/** Agents whose appearance/structure is stable; token counters etc. don't rebuild the instanced rig. */
function useRenderedAgents(runtime: WorldRuntime) {
  const signature = useWorld((s) =>
    Object.values(s.bundles[runtime.worldId]?.agents ?? {})
      .filter((a) => runtime.agents.has(a.id))
      .map((a) => `${a.id}:${a.appearance.accent}:${a.appearance.visor}:${a.appearance.accessory}`)
      .join('|'),
  )
  return useMemo(() => {
    const agents = useWorld.getState().bundles[runtime.worldId]?.agents ?? {}
    return Object.values(agents).filter((a) => runtime.agents.has(a.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, runtime])
}

function AgentBodies({ runtime }: { runtime: WorldRuntime }) {
  const controller = useCharacterController()
  const agents = useRenderedAgents(runtime)
  return (
    <>
      {agents.map((a) => (
        <AgentBody key={a.id} agentId={a.id} controller={controller} />
      ))}
    </>
  )
}

function AgentsVisual({ runtime }: { runtime: WorldRuntime }) {
  const agents = useRenderedAgents(runtime)
  return <AgentInstances agents={agents} />
}

function Lights({ layout, quality }: { layout: WorldLayout; quality: QualitySettings }) {
  const h = layout.half
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff4f8', 2.2)
    l.position.set(h * 0.7, h * 1.6, h * 0.45)
    l.castShadow = quality.shadows
    l.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
    const c = l.shadow.camera as THREE.OrthographicCamera
    c.left = c.bottom = -h * 1.2
    c.right = c.top = h * 1.2
    c.near = 1
    c.far = h * 5
    l.shadow.bias = -0.0005
    l.shadow.normalBias = 0.04
    l.shadow.radius = 4
    return l
  }, [h, quality])
  return (
    <>
      <ambientLight intensity={0.8} color="#c7b8ff" />
      <hemisphereLight args={['#a5d8ff', '#6d1a5a', 0.9]} />
      <primitive object={light} />
      <primitive object={light.target} />
      <directionalLight position={[-h, h * 0.8, -h * 0.3]} intensity={0.6} color="#8ab4ff" />
      {quality.tier !== 'low' &&
        [
          [h, h, '#22d3ee'],
          [-h, h, '#f472b6'],
          [h, -h, '#c084fc'],
          [-h, -h, '#22d3ee'],
        ].map(([x, z, c], i) => <pointLight key={i} position={[x as number, 1.5, z as number]} color={c as string} intensity={8} distance={14} decay={1.5} />)}
    </>
  )
}

function Post({ quality }: { quality: QualitySettings }) {
  return (
    <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0}>
      <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.95} luminanceSmoothing={0.2} radius={0.7} />
      {quality.tier === 'high' ? <TiltShift2 blur={0.06} taper={0.6} /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette eskil={false} offset={0.3} darkness={0.45} />
    </EffectComposer>
  )
}

export interface AIWorldProps {
  worldId: string
  active: boolean
  onConnection?: (s: ConnectionStatus) => void
}

/**
 * Mounts one World: generates its layout from the organisation, creates the
 * runtime + event wiring, and renders the R3F scene. Remounted whenever the
 * organisation's structure changes (teams / agent counts) — never on
 * high-frequency task or knowledge updates.
 */
export function AIWorld(props: AIWorldProps) {
  const structure = useWorld((s) => (s.bundles[props.worldId] ? layoutKey(s.bundles[props.worldId]) : null))
  if (structure === null) return null
  return <WorldInstance key={`${props.worldId}:${structure}`} {...props} />
}

function WorldInstance({ worldId, active, onConnection }: AIWorldProps) {
  const [bundle] = useState(() => useWorld.getState().bundles[worldId])
  const [quality] = useState(detectQuality)
  // Structure is captured at mount (the component is keyed on layoutKey).
  const [layout] = useState(() => generateLayout(bundle))
  const [runtime] = useState(() => new WorldRuntime(layout, bundle, quality.maxAgentsPerTeam))
  const teamVisuals = useMemo(() => {
    const out: Record<string, TeamVisuals> = {}
    for (const p of layout.plots) out[p.teamId] = { screens: [0, 1, 2].map((m) => createScreenMaterial(p.color, m)), glow: animatedNeon(p.color, 1) }
    return out
  }, [layout])
  const labelLayer = useRef<HTMLDivElement>(null)
  const ctx = useMemo<RuntimeContextValue>(() => ({ runtime, teamVisuals, labelLayer }), [runtime, teamVisuals])
  const eventSource = useWorld((s) => s.bundles[worldId]?.runtime.eventSource ?? 'simulated')
  const endpoint = useWorld((s) => s.bundles[worldId]?.runtime.endpoint ?? '')

  // Store ← bus: organisational state (tasks, knowledge, activity log).
  useEffect(() => {
    const off = runtime.bus.on((e) => useWorld.getState().applyEvent(worldId, e))
    return () => {
      off()
    }
  }, [runtime, worldId])

  // Event source: simulated Director, or a real backend over WebSocket / SSE.
  useEffect(() => {
    if (eventSource === 'simulated') {
      const director = new Director(runtime, () => useWorld.getState().bundles[worldId])
      director.start()
      const unregister = registerWorld(worldId, { runtime, director })
      return () => {
        director.stop()
        unregister()
        useWorld.getState().interruptActiveTasks(worldId)
      }
    }
    const unregister = registerWorld(worldId, { runtime, director: null })
    const disconnect = connectRealtime(eventSource, endpoint, runtime.bus, onConnection)
    return () => {
      disconnect()
      unregister()
    }
  }, [runtime, worldId, eventSource, endpoint, onConnection])

  useEffect(() => {
    runtime.paused = !active
  }, [runtime, active])

  return (
    <div className="world-stage">
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: quality.tier !== 'high', powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0a0f2c']} />
      <fog attach="fog" args={['#0a0f2c', 120, 260]} />
      <RuntimeContext.Provider value={ctx}>
        <SimulationLoop ctx={ctx} />
        <DebugHook runtime={runtime} />
        <WorldCamera />
        <Lights layout={layout} quality={quality} />
        <Suspense fallback={null}>
          <Physics timeStep="vary" gravity={[0, 0, 0]} paused={!active}>
            <WorldColliders layout={layout} />
            <AgentBodies runtime={runtime} />
          </Physics>
        </Suspense>
        <AgentsVisual runtime={runtime} />
        <WorldPlatform layout={layout} particles={quality.particles} />
        <Brain particles={quality.particles} />
        {layout.plots.map((p) => (
          <Department key={p.teamId} plot={p} lights={quality.tier !== 'low'} />
        ))}
        <DataPaths density={Math.max(0.5, quality.particles)} />
        <TaskParticles />
        {quality.postprocessing && <Post quality={quality} />}
      </RuntimeContext.Provider>
    </Canvas>
    {/* Stable DOM target for <Html> labels, so unmounting the canvas never races the label roots. */}
    <div ref={labelLayer} className="label-layer" />
    </div>
  )
}
