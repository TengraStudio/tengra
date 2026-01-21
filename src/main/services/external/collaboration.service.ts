import { appLogger } from '@main/logging/logger'
import { JsonObject } from '@shared/types/common'
import { safeJsonParse } from '@shared/utils/sanitize.util'
import { WebSocket, WebSocketServer } from 'ws'

export interface AgentMessage {
    id: string
    sessionId: string
    sender: string // 'planner' | 'executor' | 'system' | 'user'
    content: string
    timestamp: number
    type: 'text' | 'status' | 'code' | 'help'
    metadata?: JsonObject
}

export class CollaborationService {
    private wss: WebSocketServer | null = null
    private clients: Map<string, WebSocket[]> = new Map() // sessionId -> sockets

    constructor() {
        // We'll bind to a specific port, e.g., 3001
        this.initializeServer(3001)
    }

    private initializeServer(port: number) {
        this.wss = new WebSocketServer({ port })

        appLogger.info('collaboration.service', `[CollaborationService] WebSocket server started on port ${port}`)

        this.wss.on('connection', (ws) => {
            appLogger.info('collaboration.service', '[CollaborationService] New client connected')

            ws.on('message', (data) => {
                try {
                    const parsed = safeJsonParse<JsonObject>(data.toString(), {})

                    // Basic protocol: { type: 'join', sessionId: '...' }
                    if (parsed.type === 'join' && parsed.sessionId) {
                        this.addClient(parsed.sessionId as string, ws)
                    }

                    // Handle other incoming messages (e.g. user chat)
                    if (parsed.type === 'chat' && parsed.sessionId) {
                        this.broadcast(parsed.sessionId as string, {
                            id: Date.now().toString(),
                            sessionId: parsed.sessionId as string,
                            sender: 'user',
                            content: parsed.content as string,
                            timestamp: Date.now(),
                            type: 'text'
                        })
                    }
                } catch (e) {
                    appLogger.error('collaboration.service', '[CollaborationService] Failed to parse message', e as Error)
                }
            })

            ws.on('close', () => {
                this.removeClient(ws)
            })
        })
    }

    private addClient(sessionId: string, ws: WebSocket) {
        if (!this.clients.has(sessionId)) {
            this.clients.set(sessionId, [])
        }
        this.clients.get(sessionId)?.push(ws)
        appLogger.info('collaboration.service', `[CollaborationService] Client joined session ${sessionId}`)
    }

    private removeClient(ws: WebSocket) {
        for (const [sessionId, sockets] of this.clients.entries()) {
            const index = sockets.indexOf(ws)
            if (index !== -1) {
                sockets.splice(index, 1)
                if (sockets.length === 0) {
                    this.clients.delete(sessionId)
                }
                break
            }
        }
    }

    public broadcast(sessionId: string, message: AgentMessage) {
        const sockets = this.clients.get(sessionId)
        if (!sockets) { return }

        const payload = JSON.stringify(message)
        sockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload)
            }
        })
    }
}
