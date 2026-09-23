import { CameraControls, OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import CameraControlsImpl from 'camera-controls'
import { useWorld } from '../state/worldStore'
import { useRuntime } from '../world/RuntimeContext'
import { cameraApi } from './cameraApi'

const ISO_AZIMUTH = Math.PI / 4
const ISO_POLAR = 0.955 // ≈ atan(√2) — classic isometric
export const CAMERA_DISTANCE = 90


/**
 * Strategy-game camera: orthographic iso view, drag to pan, wheel/pinch to
 * zoom (toward the cursor), right-drag / two-finger to rotate within limits,
 * smooth cinematic focus on departments, agents and the Brain, bounded to the
 * island. Never an FPS camera.
 */
export function WorldCamera() {
  const { runtime } = useRuntime()
  // Callback-ref state: drei recreates the controls when the default camera changes.
  const [c, setControls] = useState<CameraControlsImpl | null>(null)
  const size = useThree((s) => s.size)
  const selection = useWorld((s) => s.selection)
  const focusNonce = useWorld((s) => s.focusNonce)
  const follow = useRef<string | null>(null)
  const lastInput = useRef(0)
  const half = runtime.layout.half

  const fitZoom = () => Math.max(6, Math.min(size.width / (half * 2 * (size.width < 760 ? 1.32 : 1.45)), size.height / (half * 2 * 0.98)))

  // Intro: start wide and slightly rotated, glide into the iso composition.
  useEffect(() => {
    if (!c) return
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-half, -1, -half), new THREE.Vector3(half, 4, half)))
    // Ortho: distance doesn't change framing, but keeps depth-scaled effects (sparkles) uniform.
    c.dollyTo(CAMERA_DISTANCE, false)
    c.rotateTo(ISO_AZIMUTH + 0.5, ISO_POLAR - 0.25, false)
    c.zoomTo(fitZoom() * 0.55, false)
    c.moveTo(0, 0, 0, false)
    const id = setTimeout(() => {
      c.rotateTo(ISO_AZIMUTH, ISO_POLAR, true)
      c.zoomTo(fitZoom(), true)
    }, 60)
    cameraApi.reset = () => {
      follow.current = null
      c.rotateTo(ISO_AZIMUTH, ISO_POLAR, true)
      c.moveTo(0, 0, 0, true)
      c.zoomTo(fitZoom(), true)
    }
    cameraApi.zoomBy = (k) => c.zoomTo(c.camera.zoom * k, true)
    cameraApi.rotate = (rad) => c.rotate(rad, 0, true)
    const onStart = () => {
      lastInput.current = performance.now()
      follow.current = null
    }
    c.addEventListener('controlstart', onStart)
    return () => {
      clearTimeout(id)
      c.removeEventListener('controlstart', onStart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, half])

  // Keep the focused object clear of the desktop side panel.
  useEffect(() => {
    if (!c) return
    const panel = selection && size.width > 760 ? 175 : 0
    const zoom = selection?.kind === 'agent' ? Math.max(fitZoom() * 3.4, 100) : selection?.kind === 'brain' ? Math.max(fitZoom() * 2.6, 75) : Math.max(fitZoom() * 2.2, 60)
    c.setFocalOffset(panel / zoom, 0, 0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, selection, size.width])

  // Focus the current selection.
  useEffect(() => {
    if (!c || !selection) return
    lastInput.current = performance.now()
    if (selection.kind === 'team') {
      const plot = runtime.layout.plotById[selection.id]
      if (!plot) return
      follow.current = null
      c.moveTo(plot.center[0], 0.8, plot.center[1], true)
      c.zoomTo(Math.max(fitZoom() * 2.2, 60), true)
    } else if (selection.kind === 'brain') {
      follow.current = null
      c.moveTo(0, 1.6, 0, true)
      c.zoomTo(Math.max(fitZoom() * 2.6, 75), true)
    } else if (selection.kind === 'agent') {
      follow.current = selection.id
      const a = runtime.agents.get(selection.id)
      if (a) c.moveTo(a.pos.x, 0.6, a.pos.z, true)
      c.zoomTo(Math.max(fitZoom() * 3.4, 100), true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce])

  useFrame(({ clock }, dt) => {
    if (!c) return
    if (follow.current) {
      const a = runtime.agents.get(follow.current)
      if (a) c.moveTo(a.pos.x, 0.6, a.pos.z, true)
    } else if (performance.now() - lastInput.current > 12000) {
      // gentle idle drift so the world never feels like a still illustration
      c.rotate(Math.cos(clock.elapsedTime * 0.08) * 0.01 * dt, 0, false)
    }
  })

  return (
    <>
      <OrthographicCamera makeDefault position={[52, 52, 52]} zoom={42} near={-200} far={500} />
      <CameraControls
        ref={setControls}
        makeDefault
        minZoom={5}
        minDistance={CAMERA_DISTANCE}
        maxDistance={CAMERA_DISTANCE}
        maxZoom={180}
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        minAzimuthAngle={ISO_AZIMUTH - 1.1}
        maxAzimuthAngle={ISO_AZIMUTH + 1.1}
        smoothTime={0.45}
        draggingSmoothTime={0.12}
        dollyToCursor
        mouseButtons={{
          left: CameraControlsImpl.ACTION.TRUCK, // ground-plane pan (map style)
          middle: CameraControlsImpl.ACTION.ZOOM,
          right: CameraControlsImpl.ACTION.ROTATE,
          wheel: CameraControlsImpl.ACTION.ZOOM,
        }}
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_TRUCK,
          two: CameraControlsImpl.ACTION.TOUCH_ZOOM_TRUCK,
          three: CameraControlsImpl.ACTION.TOUCH_ROTATE,
        }}
      />
    </>
  )
}
