export type ProjectDashboardTab = 'overview' | 'terminal' | 'files' | 'explorer' | 'tasks' | 'search' | 'council' | 'git' | 'issues' | 'env' | 'environment' | 'logs' | 'settings' | 'chat'
export type WorkspaceDashboardTab = ProjectDashboardTab | 'editor'

export type WorkspaceMountType = 'local' | 'ssh'

export interface WorkspaceSshConfig {
    host: string
    port?: number
    username: string
    authType?: 'password' | 'key'
    password?: string
    privateKey?: string
    passphrase?: string
}

export interface WorkspaceMount {
    id: string
    name: string
    type: WorkspaceMountType
    rootPath: string
    ssh?: WorkspaceSshConfig
}

export interface WorkspaceEntry {
    name: string
    path: string
    isDirectory: boolean
    mountId: string
    size?: number
    lastModified?: Date
    children?: WorkspaceEntry[]
    initialLine?: number
}

export interface EditorTab {
    id: string
    mountId: string
    path: string
    name: string
    content: string
    savedContent: string
    isDirty: boolean
    type: 'code' | 'image'
    initialLine?: number
}

export interface ActivityEntry {
    id: string
    timestamp: Date
    title: string
    detail?: string
    // Extended properties for council logs
    type?: 'info' | 'error' | 'success' | 'plan' | 'action'
    agentId?: string
    message: string
}
export interface MountForm {
    type: 'local' | 'ssh'
    name: string
    rootPath: string
    host: string
    port: string
    username: string
    authType: 'password' | 'key'
    password: string
    privateKey: string
    passphrase: string
}

export interface TodoItem {
    file: string
    line: number
    text: string
}
