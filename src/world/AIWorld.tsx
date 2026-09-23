import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
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
import { animatedNeon, mutedAccent, PALETTE, windUniform } from './materials'
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
      v.glow.emissiveIntensity = 0.25 + act * 0.9
    }
  }, -1)
  return null
}

/** Nudges department cards so they never hang off the edge of the scene. */
function useKeepCardsInView(layer: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const id = setInterval(() => {
      const root = layer.current
      if (!root) return
      const box = root.getBoundingClientRect()
      const m = 10
      root.querySelectorAll<HTMLElement>('.card-anchor').forEach((el) => {
        const r = el.getBoundingClientRect()
        const dx = Number(el.dataset.dx ?? 0)
        const dy = Number(el.dataset.dy ?? 0)
        const left = r.left - dx
        const top = r.top - dy
        // shift needed to fit: positive when overflowing the left/top edge, negative for right/bottom
        const cx = Math.min(Math.max(0, box.left + m - left), box.right - m - (left + r.width))
        const cy = Math.min(Math.max(0, box.top + m - top), box.bottom - m - (top + r.height))
        // Far off-screen (zoomed in on another area): hide instead of piling cards up at the edge.
        const away = Math.abs(cx) > r.width * 0.95 || Math.abs(cy) > r.height * 0.95
        if (el.classList.contains('offscreen') !== away) el.classList.toggle('offscreen', away)
        if (Math.abs(cx - dx) > 0.5 || Math.abs(cy - dy) > 0.5) {
          el.dataset.dx = String(cx)
          el.dataset.dy = String(cy)
          el.style.setProperty('--dx', `${cx}px`)
          el.style.setProperty('--dy', `${cy}px`)
        }
      })
    }, 120)
    return () => clearInterval(id)
  }, [layer])
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
    const l = new THREE.DirectionalLight('#fffaf2', 1.9)
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
      <ambientLight intensity={0.55} color="#ffffff" />
      <hemisphereLight args={['#d9dde6', '#1a1a1c', 0.7]} />
      <primitive object={light} />
      <primitive object={light.target} />
      <directionalLight position={[-h, h * 0.8, -h * 0.3]} intensity={0.35} color="#cfd6e6" />
    </>
  )
}

function Post({ quality }: { quality: QualitySettings }) {
  return (
    <EffectComposer multisampling={quality.tier === 'high' ? 4 : 0}>
      <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.1} luminanceSmoothing={0.3} radius={0.6} />
      {quality.tier === 'high' ? <TiltShift2 blur={0.04} taper={0.65} /> : <></>}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette eskil={false} offset={0.35} darkness={0.5} />
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
    for (const p of layout.plots) {
      const accent = mutedAccent(p.color)
      out[p.teamId] = { screens: [0, 1, 2].map((m) => createScreenMaterial(accent, m)), glow: animatedNeon(accent, 0.4) }
    }
    return out
  }, [layout])
  const labelLayer = useRef<HTMLDivElement>(null)
  useKeepCardsInView(labelLayer)
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
      <color attach="background" args={[PALETTE.background]} />
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
          <Department key={p.teamId} plot={p} lights={quality.tier !== 'low'} style={layout.style} />
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
