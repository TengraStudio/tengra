import { JsonValue } from '@shared/types/common'

export interface ModelUpdateEvent {
    provider: string
    count: number
    timestamp: number
}

export interface AuthStatusEvent {
    provider: string
    isAuthenticated: boolean
    username?: string
}

export interface SystemEvents {
    'model:updated': ModelUpdateEvent
    'auth:changed': AuthStatusEvent
    'config:updated': { path: string; key: string; value: JsonValue }
    'process:started': { id: string; name: string }
    'process:exited': { id: string; code: number }
    // New events for Phase 5
    'db:ready': { timestamp: number }
    'db:error': { error: string }
    'proxy:ready': { port: number }
    'proxy:error': { error: string }
    'proxy:sync-start': { provider: string }
    'proxy:sync-end': { provider: string; success: boolean }
    'token:refreshed': { provider: string; accountId?: string }
    'token:error': { provider: string; error: string }
    'settings:changed': { settings: JsonValue }
}

export type SystemEventKey = keyof SystemEvents
