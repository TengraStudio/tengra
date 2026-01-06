export interface TerminalTab {
    id: string
    name: string
    type: 'powershell' | 'cmd' | 'bash' | 'custom'
    status: 'idle' | 'running' | 'error'
    history: string[]
    command: string
    content?: string[]
    inputHistory?: string[]
}
