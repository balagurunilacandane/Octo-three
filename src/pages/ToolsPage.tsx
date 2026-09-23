import { TOOL_CATALOG } from '../domain/catalog'
import type { Tool } from '../domain/types'
import { useWorld } from '../state/worldStore'

export function ToolsPage({ worldId }: { worldId: string }) {
  const tools = useWorld((s) => s.bundles[worldId]?.tools)
  const advanced = useWorld((s) => s.advanced)
  const toggleTool = useWorld((s) => s.toggleTool)
  const updateTool = useWorld((s) => s.updateTool)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Tools</h1>
      </div>
      <p className="muted">Connected tools let your agents take action. Anything external or irreversible still asks for your approval.</p>
      <div className="tool-grid">
        {TOOL_CATALOG.map((t) => {
          const on = !!tools?.[t.id]
          const cfg = tools?.[t.id]
          return (
            <div key={t.id} className={`card tool-card${on ? ' on' : ''}`}>
              <div className="row">
                <span className="tool-icon">{t.icon}</span>
                <div className="grow">
                  <div className="strong">{t.name}</div>
                  <div className="muted small">{t.description}</div>
                </div>
                <button className={`btn small${on ? ' ghost' : ' primary'}`} onClick={() => toggleTool(worldId, t.id)}>
                  {on ? 'Disconnect' : 'Connect'}
                </button>
              </div>
              {advanced && on && cfg && (
                <div className="form-grid tight">
                  <label className="field">
                    <span>Type</span>
                    <select className="input" value={cfg.kind} onChange={(e) => updateTool(worldId, t.id, { kind: e.target.value as Tool['kind'] })}>
                      <option value="builtin">Built-in</option>
                      <option value="mcp">MCP server</option>
                      <option value="api">API</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{cfg.kind === 'mcp' ? 'MCP server URL' : cfg.kind === 'webhook' ? 'Webhook URL' : 'Endpoint'}</span>
                    <input className="input" placeholder="https://…" value={cfg.endpoint ?? ''} onChange={(e) => updateTool(worldId, t.id, { endpoint: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
