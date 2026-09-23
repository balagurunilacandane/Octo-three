import { useEffect, useRef } from 'react'
import { useWorld } from '../state/worldStore'
import type { WorldRuntime } from '../sim/WorldRuntime'

/**
 * Rounded floating label for a department (rendered via drei <Html>, so it
 * always faces the camera). Activity and attention are written straight to the
 * DOM a few times per second — no React re-render per frame.
 */
// Rendered inside drei <Html> (a separate React root), so the runtime is passed as a prop, not via context.
export function DepartmentLabel({ runtime, teamId, name, icon, color }: { runtime: WorldRuntime; teamId: string; name: string; icon: string; color: string }) {
  const bar = useRef<HTMLSpanElement>(null)
  const warn = useRef<HTMLSpanElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const selectDepartment = useWorld((s) => s.selectDepartment)
  const selected = useWorld((s) => s.selection?.kind === 'team' && s.selection.id === teamId)
  // Live name/icon so renames show immediately without rebuilding the world.
  const liveName = useWorld((s) => s.bundles[runtime.worldId]?.teams[teamId]?.name) ?? name
  const liveIcon = useWorld((s) => s.bundles[runtime.worldId]?.teams[teamId]?.icon) ?? icon

  useEffect(() => {
    const id = setInterval(() => {
      const act = runtime.activityOf(teamId)
      const att = runtime.attentionOf(teamId)
      if (bar.current) bar.current.style.width = `${Math.round(act * 100)}%`
      if (warn.current) warn.current.style.display = att > 0.05 ? 'inline-flex' : 'none'
      if (root.current) root.current.style.setProperty('--glow', `${6 + act * 18}px`)
    }, 250)
    return () => clearInterval(id)
  }, [runtime, teamId])

  return (
    <div
      ref={root}
      className={`dept-label${selected ? ' selected' : ''}`}
      style={{ ['--accent' as string]: color }}
      onClick={(e) => {
        e.stopPropagation()
        selectDepartment(teamId)
      }}
    >
      <span className="dept-icon">{liveIcon}</span>
      <span className="dept-name">{liveName.toUpperCase()}</span>
      <span ref={warn} className="dept-warn" title="Needs attention">
        !
      </span>
      <span className="dept-activity">
        <span ref={bar} />
      </span>
    </div>
  )
}
