import { useWorld } from '../state/worldStore'
import { TopBar } from '../components/TopBar'
import { Home } from './Home'
import { CreateWorldWizard } from './CreateWorldWizard'
import { WorldView } from './WorldView'

export function App() {
  const view = useWorld((s) => s.view)
  const currentWorldId = useWorld((s) => s.currentWorldId)
  const exists = useWorld((s) => !!(s.currentWorldId && s.bundles[s.currentWorldId]))

  return (
    <div className="app">
      <TopBar />
      <main className="app-main">
        {view === 'wizard' && <CreateWorldWizard />}
        {view === 'home' && <Home />}
        {view === 'world' && exists && currentWorldId && <WorldView worldId={currentWorldId} />}
        {view === 'world' && !exists && <Home />}
      </main>
    </div>
  )
}
