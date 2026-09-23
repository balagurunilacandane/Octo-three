import { lazy, Suspense, useCallback, useState } from 'react'
import type { ConnectionStatus } from '../events/realtime'
import { useWorld } from '../state/worldStore'
import { HoverTooltip } from '../components/HoverTooltip'
import { TaskPanel } from '../components/TaskPanel'
import { CameraButtons } from '../components/CameraButtons'
import { OverviewPage } from '../pages/OverviewPage'
import { TeamsPage } from '../pages/TeamsPage'
import { AgentsPage } from '../pages/AgentsPage'
import { TasksPage } from '../pages/TasksPage'
import { KnowledgePage } from '../pages/KnowledgePage'
import { ToolsPage } from '../pages/ToolsPage'
import { ActivityPage } from '../pages/ActivityPage'
import { SettingsPage } from '../pages/SettingsPage'

const AIWorld = lazy(() => import('../world/AIWorld').then((m) => ({ default: m.AIWorld })))

export function WorldView({ worldId }: { worldId: string }) {
  const tab = useWorld((s) => s.tab)
  const [conn, setConn] = useState<ConnectionStatus>('idle')
  const onConnection = useCallback((s: ConnectionStatus) => setConn(s), [])
  const inWorld = tab === 'world'

  return (
    <div className={`world-view${inWorld ? ' with-panel' : ''}`}>
      <div className={`canvas-wrap${inWorld ? '' : ' dimmed'}`}>
        <Suspense fallback={<div className="loading">Building your world…</div>}>
          <AIWorld worldId={worldId} active onConnection={onConnection} />
        </Suspense>
      </div>

      {inWorld ? (
        <>
          <HoverTooltip worldId={worldId} />
          <CameraButtons />
          <TaskPanel worldId={worldId} />
        </>
      ) : (
        <div className="page-overlay">
          {tab === 'overview' && <OverviewPage worldId={worldId} />}
          {tab === 'teams' && <TeamsPage worldId={worldId} />}
          {tab === 'agents' && <AgentsPage worldId={worldId} />}
          {tab === 'tasks' && <TasksPage worldId={worldId} />}
          {tab === 'knowledge' && <KnowledgePage worldId={worldId} />}
          {tab === 'tools' && <ToolsPage worldId={worldId} />}
          {tab === 'activity' && <ActivityPage worldId={worldId} />}
          {tab === 'settings' && <SettingsPage worldId={worldId} connection={conn} />}
        </div>
      )}
    </div>
  )
}
