export type SettingsCategory =
    | 'accounts'
    | 'general'
    | 'appearance'
    | 'models'
    | 'statistics'
    | 'gallery'
    | 'personas'
    | 'speech'
    | 'developer'
    | 'advanced'
    | 'about'
    | 'mcp-servers'
    | 'mcp-marketplace'
    | 'usage-limits';

export type DetailedStats = Awaited<ReturnType<Window['electron']['db']['getDetailedStats']>>
export type AuthStatusState = { codex: boolean; claude: boolean; antigravity: boolean; copilot?: boolean }
export type AuthFile = { provider?: string; type?: string; name?: string }
export type PersonaDraft = { name: string; description: string; prompt: string }
