# AI Worlds

**A visual operating system for AI-powered organisations.** Describe what you are building, AI Worlds proposes an organisation (teams + agents), and the 3D world is *generated from that organisation*: a dark isometric office where every team gets its own department floor with a floating stat card, agents walk, work, think and collaborate, tasks move data through a central **Brain**, and the knowledge graph grows as work completes.

The World view is laid out like an operations console: the 3D office on the left (department cards with agent counts, two team metrics and Doing / Next / Done, a "waiting approval" button when a human decision is needed, role tags over desks, dashed data lines to the Brain and out to connected tools), and a **Task status** panel on the right (type a task for any team, filter All / Backlog / In progress / Waiting / Done, approve or reject inline). The top bar shows the World, the tools it is *connected to*, the models agents *run headless on*, pending approvals and a clock. The palette is deliberately quiet — charcoal surfaces, muted team tints, serif numerals — so state changes (a selected card, an amber approval) stand out. A **Campus** scene style (Settings) swaps the desks-and-cards floors for a distinct building per team.

Built with React 19, TypeScript, React Three Fiber, Three.js, Drei, Rapier and Zustand.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # planner, layout, navigation and a headless task-flow simulation
npm run build
```

Useful URL flags: `?quality=low|medium|high` (force a render tier), `?timescale=4` (speed up the simulation), `?debug` (exposes `window.__aiworld` with renderer + runtime).

---

## What's in the vertical slice

| Area | Status |
|---|---|
| Multi-World product model (My Worlds, switcher, isolated data per World, persisted locally) | ✅ |
| Create-World wizard: describe in plain language or pick a template → goal → suggested teams → suggested agents → optional tools → review | ✅ |
| Dynamic world generation: layout, buildings, desks, nav grid, colliders and data paths are all generated from the organisation | ✅ |
| 10 building types (research lab, war room, data centre, design studio, control centre, prototype lab, broadcast tower, media studio, code tower, generic hub) with custom teams mapped by keywords | ✅ |
| Central Brain: dark plate with a floating point-cloud network, pulses, live knowledge graph (nodes cluster by department, new nodes flash, sparks travel edges) and a notes counter | ✅ |
| Agents: articulated robot rig with 9 animated states, randomised offsets, accessories / visor / accent identity | ✅ |
| Movement: grid A* with line-of-sight smoothing + Rapier kinematic character controller (agents slide along buildings/desks, never teleport) | ✅ |
| Task flow: task → agent stands → walks to station → researches → knowledge node → packet to Brain → processing → packet to target team → target agent works → optional human approval → result returns → celebration → agents return to desks | ✅ |
| Data packets along `CatmullRomCurve3` arcs with glow, pulse and trail; colour by data type | ✅ |
| Department activity (`activeTasks / maxTasks`) drives screen shader speed, desk glow, dashed-line flow speed and dot density | ✅ |
| Department stat cards (agents, 2 team metrics, Doing/Next/Done, inline approvals) that adapt to zoom and stay inside the view | ✅ |
| Task status panel + real backlog: autonomous work queues until agents are free | ✅ |
| Natural-language tasks ("Research the top 20 competitors and prepare a comparison") — auto-routed, or typed for a specific team | ✅ |
| Human-in-the-loop: plain-language policies ("…but ask me before publishing") → permission rules → approvals on cards, in the panel and the top bar | ✅ |
| Hover tooltips (agent / department / Brain), click-to-focus with smooth camera, side info panels | ✅ |
| Strategy-game camera: ortho iso, pan, zoom-to-cursor, bounded rotation, pinch/touch, cinematic intro + focus + agent follow, idle drift | ✅ |
| Simple vs Advanced mode (model, instructions, tools, MCP servers, memory, temperature, max tokens, timeout, tool endpoints, event source, export) | ✅ |
| Backend-ready: every visual reacts to `WorldEvent`s; swap the built-in simulation for WebSocket/SSE in Settings → Advanced | ✅ |
| Responsive quality tiers (desktop / tablet / mobile) | ✅ |

**Honest limits of this prototype.** Agents do not call real models or tools — task execution, results and token counts are simulated by the built-in `Director`. The org planner is a deterministic keyword heuristic (no API key needed) behind an `OrgPlanner` interface meant to be replaced by a model-backed planner. Assets are procedural (no GLB files ship yet; see *Assets*). Performance was only measured in a software-rendered headless browser, so real-GPU frame rates are unverified.

---

## Architecture

```
src/
├── app/            App shell, Home (My Worlds), CreateWorldWizard, WorldView
├── pages/          Overview, Teams, Agents, Tasks, Knowledge, Tools, Activity, Settings
├── components/     TopBar/World switcher, TaskPanel, DepartmentCard, InfoPanel, HoverTooltip, CameraButtons…
├── domain/         types, catalog (team archetypes, templates, tools, models), planner, factory
├── state/          worldStore.ts — Zustand, one isolated WorldBundle per World (persisted)
├── events/         WorldEvent protocol, EventBus, WebSocket/SSE client
├── sim/            WorldRuntime (high-frequency state), Director (simulated backend)
├── tasks/          TaskSystem (requests, approvals), TaskParticle (pooled packets)
├── agents/         Agent (instanced renderer + physics bodies), AgentAnimator, AgentNavigation (A*), AgentPhysics
├── camera/         WorldCamera (camera-controls), cameraApi
├── world/          AIWorld (scene root), layout generator, WorldPlatform, Department, Building(s), Brain,
│                   KnowledgeGraph, DataPath, StaticBatch, materials, quality tiers
├── shaders/        animated screen shader
└── assets/         GLB manifest (optional overrides)
```

### Data flow

```
Zustand store (Worlds → Teams → Agents, Tasks, Knowledge, Tools, Permissions)
   │  structure (teams, agent counts, building types) — rebuilds the world only when it changes
   ▼
generateLayout()  →  plots, desks, stations, obstacles, docks, heightfield
   ▼
WorldRuntime  ◀── WorldEvents ── Director (simulated)  |  WebSocket / SSE (real backend)
   │  agent positions, paths, states, packets, activity, Brain pulse (plain objects, no React)
   ▼
useFrame loop  →  instanced agents, packets, graph, shaders, materials
```

* **High-frequency state never touches React.** Positions, poses, packets and activity live in `WorldRuntime` and are read in `useFrame`. React re-renders only on organisational changes (a task completes, a node is learned).
* **One frame loop.** `SimulationLoop` advances the runtime; the instanced agent renderer turns poses into matrices.
* **The Director only speaks events.** Everything it does is expressed as `WorldEvent`s on the bus; the runtime and the store react to events. A real backend streaming the same events drives the world identically.

### Performance

* All agents render through ~25 `InstancedMesh`es (one per body part) — the draw-call cost is independent of the number of agents.
* `StaticBatch` merges every static mesh of a department (plot, building, desks, station, plants) into one mesh per material after mount; animated parts are tagged `DYNAMIC` and left alone. Foliage sways in a vertex shader so it can be batched too.
* Shared geometries/materials, pooled packets (one instanced draw for all packets + trails), one screen shader material per department.
* Quality tiers adjust DPR, shadows, post-processing (bloom, tilt-shift DOF, neutral tone mapping, vignette), particle density, point lights and max visible agents per team.

Department counters on the cards start at 0 and only grow as simulated work completes — no numbers are invented.

---

## Real-time backend integration

Set **Settings → Advanced → Event source** to *WebSocket* or *Server-Sent Events* and enter the endpoint. Each message is one JSON event (or an array of them). IDs are the World's own team / agent / task IDs (visible via *Export World JSON*).

```json
{ "event": "agent.task.started", "agentId": "agent-…", "taskId": "task-129", "department": "team-…" }
```

| Event | Payload | Effect in the world |
|---|---|---|
| `task.created` | `task` | task indicator, department activity rises |
| `task.assigned` / `task.started` | `taskId`, `agentId` | |
| `task.waiting` / `task.approved` / `task.rejected` | `taskId`, `reason` | approval tray, attention badge on the department |
| `task.completed` / `task.failed` | `taskId`, `result`, `tokens` | results, token accounting |
| `agent.walking` | `agentId`, `to: {kind:'desk'} \| {kind:'station',teamId} \| {kind:'brain'} \| {kind:'agent',agentId} \| {kind:'team',teamId}` | agent path-finds and walks there; emits `agent.arrived` |
| `agent.thinking` · `agent.working` · `agent.researching` · `agent.communicating` · `agent.waiting` · `agent.completed` · `agent.error` · `agent.idle` | `agentId` | animation state |
| `knowledge.created` / `knowledge.connected` | `node` / `source,target,strength` | Brain flash, graph grows |
| `data.transfer` | `transferId, from, to, dataType` | glowing packet along an arc; emits `data.arrived` |
| `brain.processing` | `durationSec` | Brain spins up and pulses |
| `department.activity.changed` | `department, activity (0..1)` | overrides computed activity |

User requests currently go to the in-browser `TaskSystem`; in production `submitPlan` / `approveTask` become API calls.

## Replacing the planner with a model

`domain/planner.ts` defines `OrgPlanner` (`proposeOrganization`, `proposeTeam`, `defineAgent`, `planRequest`, `parsePolicy`). Implement it against your backend (e.g. an endpoint that calls Claude with a JSON schema) and register it with `setPlanner()` from `tasks/TaskSystem.ts`. Keep API keys server-side.

## Assets

Everything visible is real geometry; nothing uses the reference image. Buildings, props and agents are procedural and share one visual language (rounded pastel bodies, dark trims, neon accents). To use authored models, drop compressed `.glb` files into `public/assets/world/…` and register them in `src/assets/manifest.ts`; `Building` loads them with `useGLTF` and falls back to the procedural version while loading. Footprints in `world/buildings/footprints.ts` drive both navigation and collision.
