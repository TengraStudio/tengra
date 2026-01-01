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
