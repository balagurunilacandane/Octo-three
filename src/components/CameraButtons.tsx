import { cameraApi } from '../camera/cameraApi'

export function CameraButtons() {
  return (
    <div className="camera-buttons">
      <button onClick={() => cameraApi.zoomBy(1.3)} title="Zoom in" aria-label="Zoom in">
        ＋
      </button>
      <button onClick={() => cameraApi.zoomBy(1 / 1.3)} title="Zoom out" aria-label="Zoom out">
        －
      </button>
      <button onClick={() => cameraApi.rotate(-0.4)} title="Rotate left" aria-label="Rotate left">
        ⟲
      </button>
      <button onClick={() => cameraApi.rotate(0.4)} title="Rotate right" aria-label="Rotate right">
        ⟳
      </button>
      <button onClick={() => cameraApi.reset()} title="Reset view" aria-label="Reset view">
        ⌂
      </button>
      <div className="camera-hint">Drag to pan · Scroll / pinch to zoom · Right-drag to rotate · Click to focus</div>
    </div>
  )
}
