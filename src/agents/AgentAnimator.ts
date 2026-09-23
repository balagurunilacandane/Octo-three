import * as THREE from 'three'
import type { AgentState } from '../domain/types'
import type { AgentRuntime } from '../sim/WorldRuntime'

// Procedural animation for the robot agents. A pure function of runtime state
// + time that writes a compact pose; the instanced renderer turns poses into
// matrices for every body part of every agent in a handful of draw calls.

export interface AgentPose {
  legL: number
  legR: number
  armLx: number
  armRx: number
  armLz: number
  armRz: number
  headX: number
  headY: number
  headZ: number
  hipsY: number
  breathe: number
  indicator: number // scale, 0 = hidden
  indicatorY: number
  indicatorColor: THREE.Color
  thought: number // 0 = hidden, else phase
  task: number // 0 = hidden
  taskY: number
  visor: THREE.Color
  burst: number // 0..1 remaining flash
  burstColor: THREE.Color
}

export function createPose(): AgentPose {
  return {
    legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0.12, armRz: -0.12, headX: 0, headY: 0, headZ: 0,
    hipsY: 0, breathe: 1, indicator: 0, indicatorY: 1.32, indicatorColor: new THREE.Color(),
    thought: 0, task: 0, taskY: 1.55, visor: new THREE.Color(), burst: 0, burstColor: new THREE.Color(),
  }
}

export const STATE_COLORS: Record<AgentState, string> = {
  idle: '#8a8f98',
  working: '#8fd3c8',
  thinking: '#b8aee6',
  walking: '#d5d5d8',
  researching: '#93bfe3',
  communicating: '#e6cf8f',
  waiting: '#e2b567',
  completed: '#c6d68a',
  error: '#e08a80',
}
const STATE_COLOR_OBJ = Object.fromEntries(Object.entries(STATE_COLORS).map(([k, v]) => [k, new THREE.Color(v)])) as Record<AgentState, THREE.Color>
const RED = new THREE.Color('#e0655a')
const LIME = new THREE.Color('#c6d68a')

export function animateAgent(p: AgentPose, a: AgentRuntime, t: number, visorBase: THREE.Color) {
  const o = a.offset * 10
  const st = a.stateTime
  const s = a.state
  const walking = a.path.length > 0 && a.sit < 0.05

  let armLx = 0.05, armRx = 0.05, armLz = 0.12, armRz = -0.12
  let legLx = 0, legRx = 0, headY = 0, headX = 0, headZ = 0, bob = 0
  let breathe = 1 + Math.sin(t * 2.2 + o) * 0.018

  if (walking) {
    const ph = a.walkPhase
    legLx = Math.sin(ph) * 0.75
    legRx = -Math.sin(ph) * 0.75
    armLx = -Math.sin(ph) * 0.6
    armRx = Math.sin(ph) * 0.6
    bob = Math.abs(Math.sin(ph)) * 0.05
    headX = 0.05
    breathe = 1
  } else {
    switch (s) {
      case 'idle':
        headY = Math.sin(t * 0.5 + o) * 0.35
        headX = Math.sin(t * 0.37 + o) * 0.08
        armLz = 0.12 + Math.sin(t * 0.8 + o) * 0.04
        break
      case 'working': {
        const k = Math.sin(t * 16 + o)
        armLx = -1.15 + k * 0.08
        armRx = -1.15 - k * 0.08
        armLz = 0.25
        armRz = -0.25
        headX = 0.18 + Math.sin(t * 1.7 + o) * 0.05
        headY = Math.sin(t * 0.6 + o) * 0.12
        break
      }
      case 'thinking':
        headZ = 0.25
        headX = -0.12
        armRx = -2.1
        armRz = 0.35
        headY = Math.sin(t * 0.8 + o) * 0.1
        break
      case 'researching':
        armRx = -1.35 + Math.sin(t * 3 + o) * 0.1
        armLx = -0.7
        headY = Math.sin(t * 1.3 + o) * 0.4
        headX = -0.08
        break
      case 'communicating':
        armRx = -1.3 + Math.sin(t * 6 + o) * 0.35
        armRz = -0.3 + Math.sin(t * 4 + o) * 0.15
        headX = Math.sin(t * 5 + o) * 0.06
        bob = Math.abs(Math.sin(t * 5 + o)) * 0.015
        break
      case 'waiting':
        armLz = 0.05
        armRz = -0.05
        legRx = st % 1.2 < 0.25 ? -0.2 : 0 // impatient foot tap
        headY = Math.sin(t * 0.9 + o) * 0.2
        break
      case 'completed': {
        const k = Math.min(1, st / 1.4)
        bob = st < 1.4 ? Math.abs(Math.sin(st * 7.5)) * 0.22 * (1 - k) : 0
        armLx = -2.7 * (1 - k * 0.5)
        armRx = -2.7 * (1 - k * 0.5)
        armLz = 0.4
        armRz = -0.4
        headX = -0.2
        break
      }
      case 'error':
        headY = st < 1.2 ? Math.sin(t * 22) * 0.15 : 0
        headX = 0.2
        armLz = 0.05
        armRz = -0.05
        breathe = 1
        break
    }
  }

  // seated blend: legs forward, body onto the chair
  const sit = a.sit
  if (sit > 0.001) {
    legLx = legLx * (1 - sit) - 1.45 * sit
    legRx = legRx * (1 - sit) - 1.45 * sit
  }

  const k = walking ? 1 : 0.25
  const e = 0.25
  p.legL += (legLx - p.legL) * k
  p.legR += (legRx - p.legR) * k
  p.armLx += (armLx - p.armLx) * k
  p.armRx += (armRx - p.armRx) * k
  p.armLz += (armLz - p.armLz) * e
  p.armRz += (armRz - p.armRz) * e
  p.headX += (headX - p.headX) * e
  p.headY += (headY - p.headY) * e
  p.headZ += (headZ - p.headZ) * e
  p.hipsY = bob + sit * 0.13
  p.breathe = breathe

  const showIndicator = !walking && s !== 'walking' && s !== 'idle'
  if (showIndicator) {
    const pulse = s === 'error' || s === 'waiting' ? 0.6 + Math.abs(Math.sin(t * 5)) * 0.6 : 0.85 + Math.sin(t * 3 + o) * 0.15
    p.indicator = 0.07 * pulse
    p.indicatorY = 1.32 + Math.sin(t * 2 + o) * 0.03
    p.indicatorColor.copy(STATE_COLOR_OBJ[s])
  } else p.indicator = 0

  p.thought = s === 'thinking' && !walking ? t : 0
  p.task = a.currentTaskId ? t * 2.5 + 0.0001 : 0
  p.taskY = 1.55 + Math.sin(t * 3 + o) * 0.04

  if (s === 'error') p.visor.copy(Math.sin(t * 12) > 0 ? RED : visorBase).multiplyScalar(Math.sin(t * 12) > 0 ? 1.2 : 0.4)
  else p.visor.copy(visorBase).multiplyScalar(s === 'working' || s === 'researching' ? 1.05 + Math.sin(t * 8 + o) * 0.1 : 0.9)

  p.burst = a.flash
  p.burstColor.copy(s === 'error' ? RED : LIME).multiplyScalar(a.flash * 0.9)
}
