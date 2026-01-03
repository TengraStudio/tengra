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
