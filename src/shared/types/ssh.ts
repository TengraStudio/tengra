export interface SSHConnection {
    id: string
    name: string
    host: string
    username: string
    status: 'connected' | 'disconnected' | 'connecting' | 'error'
    error?: string
    password?: string
    privateKey?: string
}

export interface SSHConfig {
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}
