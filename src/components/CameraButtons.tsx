import { cameraApi } from '../camera/cameraApi'

/** Round zoom / home controls at the bottom-right of the scene. */
export function CameraButtons() {
  return (
    <div className="camera-buttons">
      <button onClick={() => cameraApi.zoomBy(1.3)} title="Zoom in" aria-label="Zoom in">
        +
      </button>
      <button onClick={() => cameraApi.zoomBy(1 / 1.3)} title="Zoom out" aria-label="Zoom out">
        −
      </button>
      <button onClick={() => cameraApi.reset()} title="Reset view" aria-label="Reset view">
        ⌂
      </button>
    </div>
  )
}
