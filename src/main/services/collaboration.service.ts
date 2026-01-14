import { WebSocketServer, WebSocket } from 'ws'
import { JsonObject } from '@shared/types/common'

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
        // We'll bind to a specific port, e.g., 3001 or let the OS pick if we want strict internal use,
        // but for now 3001 is a good default for the "Agent Bus".
        // In a real app we might attach to the main HTTP server, but a separate port is cleaner for this addon.
        this.initializeServer(3001)
    }

    private initializeServer(port: number) {
        this.wss = new WebSocketServer({ port })

        console.log(`[CollaborationService] WebSocket server started on port ${ port } `)

        this.wss.on('connection', (ws) => {
            console.log('[CollaborationService] New client connected')

            ws.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString())
                    // Basic protocol: { type: 'join', sessionId: '...' }
                    if (parsed.type === 'join' && parsed.sessionId) {
                        this.addClient(parsed.sessionId, ws)
                    }
                    // Handle other incoming messages (e.g. user chat)
                    if (parsed.type === 'chat' && parsed.sessionId) {
                        this.broadcast(parsed.sessionId, {
                            id: Date.now().toString(),
                            sessionId: parsed.sessionId,
                            sender: 'user',
                            content: parsed.content,
                            timestamp: Date.now(),
                            type: 'text'
                        })
                    }
                } catch (e) {
                    console.error('[CollaborationService] Failed to parse message', e)
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
        console.log(`[CollaborationService] Client joined session ${ sessionId } `)
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
        if (!sockets) return

        const payload = JSON.stringify(message)
        sockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload)
            }
        })
    }
}
