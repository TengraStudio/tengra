export interface SSHConnection {
    id: string
    name: string
    host: string
    port: number
    username: string
    status: 'connected' | 'disconnected' | 'connecting' | 'error'
    error?: string
    authType?: 'password' | 'key'
    password?: string
    privateKey?: string
    passphrase?: string
}

export interface SSHConfig {
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}

export interface SSHFile {
    name: string;
    isDirectory: boolean;
    size?: number;
    mtime?: number;
    permissions?: string;
}

export interface SSHExecOptions {
    cwd?: string;
    env?: Record<string, string>;
}

export interface SSHDiskStat {
    filesystem: string;
    used: string;
    total: string;
    percent: string;
}

export interface SSHSystemStats {
    uptime: string;
    memory: { total: number; used: number; percent: number };
    cpu: number;
    disk: string | SSHDiskStat[];
    error?: string;
}

export interface SSHPackageInfo {
    name: string;
    version: string;
    status?: string;
}
