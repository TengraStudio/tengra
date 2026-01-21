import { safeJsonParse } from '@shared/utils/sanitize.util'
import { useEffect, useState } from 'react'

import { ActivityEntry, CouncilSession } from '@/types'

interface UseCouncilWSProps {
    councilSession: CouncilSession | null
    notify: (type: 'success' | 'error' | 'info', message: string) => void
}

export function useCouncilWS({ councilSession, notify }: UseCouncilWSProps) {
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

    useEffect(() => {
        if (!councilSession?.id) { return }

        const wsUrl = (import.meta.env.VITE_WEBSOCKET_URL as string | undefined) ?? 'ws://localhost:3001'

        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            console.error('[CouncilWS] Invalid WebSocket URL:', wsUrl)
            setTimeout(() => notify('error', 'Invalid WebSocket configuration'), 0)
            return
        }

        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join', sessionId: councilSession.id }))
        }

        ws.onmessage = (event) => {
            try {
                const msg = safeJsonParse<Record<string, unknown> | null>(event.data, null)
                if (!msg) { return }
                if (msg.sessionId === councilSession.id) {
                    setActivityLog(prev => [...prev, {
                        id: String(msg.id),
                        title: String(msg.sender).toUpperCase(),
                        agentId: String(msg.sender),
                        message: String(msg.content),
                        type: (msg.type === 'job' ? 'info' : (msg.type === 'error' ? 'error' : 'info')) as 'info' | 'error' | 'success' | 'plan',
                        timestamp: new Date(msg.timestamp as string | number | Date)
                    }])
                }
            } catch (_e) {
                console.error('Failed to parse WS message:', _e)
            }
        }

        ws.onerror = (error) => {
            console.error('[CouncilWS] WebSocket error:', error)
            setTimeout(() => notify('error', 'WebSocket connection error'), 0)
        }

        ws.onclose = () => {
            console.warn('[CouncilWS] WebSocket connection closed')
        }

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close()
            }
        }
    }, [councilSession, notify])

    return { activityLog, setActivityLog }
}
