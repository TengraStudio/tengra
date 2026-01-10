export interface SystemUsage {
    cpu: number
    memory: {
        total: number
        used: number
        percent: number
    }
    battery?: {
        percent: number
        isCharging: boolean
    }
}

export interface SystemStats {
    cpu: number
    memory: {
        total: number
        used: number
        free: number
    }
    disk: DiskStats
    uptime: number
    platform: string
    distro?: string
}

export interface FileEntry {
    name: string
    path: string
    isDirectory: boolean
}

export interface ProcessInfo {
    pid: number
    name: string
    cpu: number
    memory: number
}

export interface DiskStats {
    total: number
    free: number
    used: number
    percent: number
}

export interface SystemInfo {
    platform: string
    arch: string
    cpus: number
    totalMemory: number
    freeMemory: number
    uptime: number
    hostname: string
    release: string
    shell?: string
    [key: string]: string | number | undefined
}
