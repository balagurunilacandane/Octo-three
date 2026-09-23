import type { AccessoryType, BuildingType, Tool } from './types'

/**
 * A team archetype describes how a kind of team looks and behaves.
 * Custom teams are matched to an archetype by keywords and fall back to `generic`,
 * so the asset library never depends on every possible team name.
 */
export interface TeamArchetype {
  key: string
  label: string
  icon: string
  color: string
  building: BuildingType
  keywords: string[]
  description: string
  agents: { name: string; role: string }[]
  tasks: string[]
  knowledge: string[]
  accessory: AccessoryType
}

export const ARCHETYPES: TeamArchetype[] = [
  {
    key: 'research', label: 'Research', icon: '🔬', color: '#22d3ee', building: 'research', accessory: 'antenna',
    keywords: ['research', 'investigat', 'study', 'intelligence', 'competitor', 'insight', 'discovery', 'validation', 'grant', 'market research', 'interview'],
    description: 'Finds facts, sources and insights.',
    agents: [
      { name: 'Research Agent', role: 'Finds and summarises sources' },
      { name: 'Competitor Analyst', role: 'Tracks competitors and pricing' },
      { name: 'Interview Analyst', role: 'Extracts insight from conversations' },
    ],
    tasks: ['Analyze competitor data', 'Summarize market report', 'Collect user interviews', 'Scan new papers', 'Benchmark pricing'],
    knowledge: ['Competitor pricing', 'Market size', 'User pain points', 'Trend signal', 'Source digest'],
  },
  {
    key: 'strategy', label: 'Strategy', icon: '🎯', color: '#facc15', building: 'strategy', accessory: 'badge',
    keywords: ['strategy', 'plan', 'vision', 'roadmap', 'goal', 'okr', 'leadership', 'business'],
    description: 'Turns insight into priorities and plans.',
    agents: [
      { name: 'Strategy Lead', role: 'Sets priorities and plans' },
      { name: 'Planning Agent', role: 'Breaks goals into milestones' },
    ],
    tasks: ['Draft quarterly plan', 'Prioritize roadmap', 'Define positioning', 'Review goals'],
    knowledge: ['Positioning', 'Quarter plan', 'Risk register', 'Priority stack'],
  },
  {
    key: 'data', label: 'Data', icon: '📊', color: '#3b82f6', building: 'data', accessory: 'headset',
    keywords: ['data', 'analytics', 'metric', 'finance', 'report', 'dashboard', 'sql', 'insights', 'accounting'],
    description: 'Collects, cleans and analyses data.',
    agents: [
      { name: 'Data Analyst', role: 'Builds reports and dashboards' },
      { name: 'Analytics Agent', role: 'Tracks metrics and anomalies' },
      { name: 'Data Engineer', role: 'Keeps pipelines healthy' },
    ],
    tasks: ['Build weekly dashboard', 'Clean customer dataset', 'Detect metric anomaly', 'Forecast revenue'],
    knowledge: ['Retention curve', 'Revenue forecast', 'Cohort table', 'Anomaly report'],
  },
  {
    key: 'design', label: 'Design', icon: '🎨', color: '#c084fc', building: 'design', accessory: 'cap',
    keywords: ['design', 'brand', 'creative', 'thumbnail', 'ui', 'ux', 'visual', 'art', 'illustrat'],
    description: 'Creates visuals, brand and interfaces.',
    agents: [
      { name: 'Brand Designer', role: 'Keeps the brand consistent' },
      { name: 'Thumbnail Designer', role: 'Designs eye-catching visuals' },
      { name: 'UX Designer', role: 'Designs flows and screens' },
    ],
    tasks: ['Design landing hero', 'Create thumbnail set', 'Refresh brand palette', 'Prototype onboarding'],
    knowledge: ['Brand palette', 'Design system', 'Visual moodboard', 'UX pattern'],
  },
  {
    key: 'operations', label: 'Operations', icon: '⚙️', color: '#4ade80', building: 'operations', accessory: 'headset',
    keywords: ['operation', 'ops', 'support', 'customer', 'logistic', 'workflow', 'admin', 'hr', 'legal', 'wedding', 'planning event'],
    description: 'Keeps the organisation running smoothly.',
    agents: [
      { name: 'Ops Coordinator', role: 'Coordinates workflows' },
      { name: 'Support Agent', role: 'Answers customer questions' },
      { name: 'Monitoring Agent', role: 'Watches systems and SLAs' },
    ],
    tasks: ['Triage support tickets', 'Automate onboarding workflow', 'Review SLA breaches', 'Update runbook'],
    knowledge: ['Runbook', 'Ticket themes', 'SLA status', 'Process map'],
  },
  {
    key: 'product', label: 'Product', icon: '📦', color: '#2dd4bf', building: 'product', accessory: 'badge',
    keywords: ['product', 'app', 'feature', 'prototype', 'launch', 'e-commerce', 'ecommerce', 'shop', 'store', 'mobile'],
    description: 'Decides what to build and ships it.',
    agents: [
      { name: 'Product Manager', role: 'Writes specs and prioritises' },
      { name: 'Prototype Agent', role: 'Builds quick prototypes' },
    ],
    tasks: ['Write feature spec', 'Prototype new flow', 'Plan release', 'Review feedback backlog'],
    knowledge: ['Feature spec', 'Release plan', 'Feedback cluster', 'Prototype result'],
  },
  {
    key: 'marketing', label: 'Marketing', icon: '📣', color: '#fb7185', building: 'marketing', accessory: 'cap',
    keywords: ['marketing', 'growth', 'seo', 'social', 'campaign', 'ads', 'sales', 'promotion', 'newsletter', 'community', 'pr'],
    description: 'Tells the world and grows the audience.',
    agents: [
      { name: 'Campaign Manager', role: 'Plans and runs campaigns' },
      { name: 'SEO Agent', role: 'Optimises search visibility' },
      { name: 'Social Media Agent', role: 'Creates and schedules posts' },
    ],
    tasks: ['Draft launch campaign', 'Create social posts', 'Optimize SEO keywords', 'Plan newsletter'],
    knowledge: ['Campaign brief', 'Keyword map', 'Audience persona', 'Channel mix'],
  },
  {
    key: 'content', label: 'Content', icon: '✍️', color: '#f472b6', building: 'studio', accessory: 'headset',
    keywords: ['content', 'writ', 'script', 'blog', 'copy', 'story', 'course', 'lesson', 'education', 'exam'],
    description: 'Writes scripts, articles and lessons.',
    agents: [
      { name: 'Content Writer', role: 'Writes long-form content' },
      { name: 'Script Writer', role: 'Writes scripts and outlines' },
      { name: 'Editor Agent', role: 'Edits for clarity and tone' },
    ],
    tasks: ['Write episode script', 'Draft blog article', 'Outline lesson series', 'Edit final copy'],
    knowledge: ['Script draft', 'Content calendar', 'Style guide', 'Topic cluster'],
  },
  {
    key: 'video', label: 'Video', icon: '🎬', color: '#f97316', building: 'studio', accessory: 'headset',
    keywords: ['video', 'youtube', 'film', 'edit', 'audio', 'podcast', 'music', 'media', 'studio'],
    description: 'Produces video and audio.',
    agents: [
      { name: 'Video Editor', role: 'Cuts and polishes video' },
      { name: 'Audio Engineer', role: 'Mixes and masters audio' },
    ],
    tasks: ['Edit episode cut', 'Mix podcast audio', 'Render shorts', 'Add captions'],
    knowledge: ['Edit decision list', 'Audio preset', 'Shorts plan', 'Caption file'],
  },
  {
    key: 'engineering', label: 'Engineering', icon: '💻', color: '#60a5fa', building: 'engineering', accessory: 'antenna',
    keywords: ['engineer', 'develop', 'code', 'software', 'backend', 'frontend', 'devops', 'api', 'saas', 'platform', 'tech'],
    description: 'Builds and maintains software.',
    agents: [
      { name: 'Backend Engineer', role: 'Builds APIs and services' },
      { name: 'Frontend Engineer', role: 'Builds interfaces' },
      { name: 'QA Agent', role: 'Tests and reports bugs' },
    ],
    tasks: ['Implement API endpoint', 'Fix login bug', 'Write integration tests', 'Review pull request'],
    knowledge: ['API contract', 'Bug report', 'Test coverage', 'Architecture note'],
  },
]

export const GENERIC_ARCHETYPE: TeamArchetype = {
  key: 'generic', label: 'Team', icon: '✨', color: '#a78bfa', building: 'generic', accessory: 'none',
  keywords: [],
  description: 'A custom team.',
  agents: [{ name: 'Specialist Agent', role: 'Handles the team\'s work' }, { name: 'Assistant Agent', role: 'Supports the specialist' }],
  tasks: ['Complete assigned work', 'Prepare summary', 'Review progress'],
  knowledge: ['Team note', 'Progress summary', 'Finding'],
}

export function archetypeByKey(key: string): TeamArchetype {
  return ARCHETYPES.find((a) => a.key === key) ?? GENERIC_ARCHETYPE
}

/** Match any free-form team name / description to the closest archetype. */
export function matchArchetype(text: string): TeamArchetype {
  const t = text.toLowerCase()
  let best: TeamArchetype = GENERIC_ARCHETYPE
  let bestScore = 0
  for (const a of ARCHETYPES) {
    let score = 0
    if (t.includes(a.label.toLowerCase())) score += 3
    for (const k of a.keywords) if (t.includes(k)) score += k.length > 5 ? 2 : 1
    if (score > bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

const CUSTOM_COLORS = ['#a78bfa', '#34d399', '#fbbf24', '#38bdf8', '#f472b6', '#a3e635', '#fb923c', '#e879f9']
export function colorForName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CUSTOM_COLORS[h % CUSTOM_COLORS.length]
}

export interface WorldTemplate {
  key: string
  icon: string
  label: string
  prompt: string
  teams: string[]
}

export const WORLD_TEMPLATES: WorldTemplate[] = [
  { key: 'startup', icon: '🚀', label: 'Start a SaaS business', prompt: 'I want to start a SaaS business.', teams: ['strategy', 'research', 'engineering', 'product', 'design', 'marketing', 'operations'] },
  { key: 'app', icon: '📱', label: 'Build a mobile app', prompt: 'I want to build a mobile app.', teams: ['research', 'product', 'design', 'engineering', 'marketing'] },
  { key: 'marketing', icon: '📣', label: 'Run a marketing team', prompt: 'I want to run a marketing team.', teams: ['strategy', 'research', 'content', 'design', 'marketing', 'data'] },
  { key: 'research', icon: '🔬', label: 'Research a topic', prompt: 'I want to research a topic in depth.', teams: ['research', 'data', 'content', 'strategy'] },
  { key: 'content', icon: '🎥', label: 'Create a content business', prompt: 'I want to create a YouTube channel.', teams: ['research', 'content', 'design', 'video', 'marketing'] },
  { key: 'agency', icon: '🏢', label: 'Manage an agency', prompt: 'I want to manage a creative agency.', teams: ['strategy', 'design', 'content', 'marketing', 'operations', 'data'] },
  { key: 'education', icon: '📚', label: 'Education platform', prompt: 'I want to build an education platform for exam students.', teams: ['research', 'content', 'product', 'engineering', 'marketing'] },
  { key: 'ecommerce', icon: '🛒', label: 'E-commerce brand', prompt: 'I want to launch an e-commerce clothing brand.', teams: ['strategy', 'research', 'design', 'product', 'marketing', 'operations'] },
]

export const TOOL_CATALOG: Tool[] = [
  { id: 'web-search', name: 'Web Search', icon: '🔎', description: 'Search the web for sources', category: 'research', kind: 'builtin' },
  { id: 'browser', name: 'Browser', icon: '🌐', description: 'Open and read web pages', category: 'research', kind: 'builtin' },
  { id: 'database', name: 'Database', icon: '🗄️', description: 'Query your data', category: 'data', kind: 'api' },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Send and read messages', category: 'communication', kind: 'mcp' },
  { id: 'github', name: 'GitHub', icon: '🐙', description: 'Read code, open pull requests', category: 'dev', kind: 'mcp' },
  { id: 'email', name: 'Email', icon: '✉️', description: 'Draft and send email', category: 'communication', kind: 'api' },
  { id: 'drive', name: 'Google Drive', icon: '📁', description: 'Read and write documents', category: 'data', kind: 'mcp' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', description: 'Publish and analyse videos', category: 'media', kind: 'api' },
  { id: 'shopify', name: 'Shopify', icon: '🛍️', description: 'Manage products and orders', category: 'commerce', kind: 'api' },
]

export const MODEL_OPTIONS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Claude' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'Claude' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Claude' },
  { id: 'gpt', label: 'GPT (OpenAI)', provider: 'GPT' },
  { id: 'gemini', label: 'Gemini (Google)', provider: 'Gemini' },
  { id: 'ollama:llama', label: 'Ollama (local)', provider: 'Ollama' },
]

/** Actions that typically need a human in the loop. */
export const SENSITIVE_ACTIONS: { action: string; label: string; keywords: string[] }[] = [
  { action: 'publish', label: 'Publish content', keywords: ['publish', 'post it', 'go live', 'release', 'upload'] },
  { action: 'spend', label: 'Spend budget', keywords: ['spend', 'budget', 'buy', 'purchase', 'ads', 'pay'] },
  { action: 'email', label: 'Send external email', keywords: ['send email', 'email', 'outreach', 'contact'] },
  { action: 'deploy', label: 'Deploy to production', keywords: ['deploy', 'ship to production', 'merge'] },
]
