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
}

export interface ActivityEntry {
    id: string
    timestamp: Date
    title: string
    detail?: string
}
