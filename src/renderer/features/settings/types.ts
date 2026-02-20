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
    | 'images'
    | 'usage-limits'
    | 'voice';

export type DetailedStats = Awaited<ReturnType<Window['electron']['db']['getDetailedStats']>>
export type AuthStatusState = { codex: boolean; claude: boolean; antigravity: boolean; copilot?: boolean }
export type AuthFile = { provider?: string; type?: string; name?: string }
export type PersonaDraft = { name: string; description: string; prompt: string }
export type TimeStats = Awaited<ReturnType<Window['electron']['db']['getTimeStats']>>
export interface AccountWrapper<T> {
    accounts: (T & { accountId?: string; email?: string; error?: string })[]
}

export * from './types/props';
