
import { useCallback, useEffect, useState } from 'react'

import { SSHConnection } from '@/types'

interface SSHProfile {
    id: string
    name: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}

export function useSSHConnections(isOpen: boolean) {
    const [connections, setConnections] = useState<SSHConnection[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

    const updateConnectionStatus = useCallback((id: string, status: SSHConnection['status'], error?: string) => {
        setConnections(prev => prev.map(c => {
            if (c.id !== id) {return c}

            const content = { ...c, status } as SSHConnection
            if (error !== undefined) {
                content.error = error
            } else {
                delete content.error
            }
            return content
        }))
    }, [])

    const loadConnections = useCallback(async () => {
        try {
            const profilesRaw = await window.electron.ssh.getProfiles() as SSHProfile[] || []
            const activeConns = await window.electron.ssh.getConnections() || []

            const merged: SSHConnection[] = profilesRaw.map(p => {
                const conn: SSHConnection = {
                    id: p.id ?? '',
                    name: p.name ?? '',
                    host: p.host ?? '',
                    port: p.port ?? 22,
                    username: p.username ?? '',
                    status: 'disconnected' as const,
                    authType: p.privateKey ? 'key' : 'password'
                }
                if (p.password) {conn.password = p.password}
                if (p.privateKey) {conn.privateKey = p.privateKey}
                return conn
            })

            for (const active of activeConns) {
                const existingIndex = merged.findIndex(p => p.id === active.id)
                if (existingIndex >= 0) {
                    const current = merged[existingIndex]
                    const updated: SSHConnection = {
                        ...current,
                        ...active,
                        status: 'connected' as const
                    }
                    // Handle error property safely for exactOptionalPropertyTypes
                    if (active.error) {
                        updated.error = active.error
                    } else {
                        delete updated.error
                    }

                    merged[existingIndex] = updated
                } else {
                    const newConn: SSHConnection = {
                        ...active,
                        status: 'connected' as const
                    } as SSHConnection
                    if (!active.error) {delete newConn.error}

                    merged.push(newConn)
                }
            }

            setConnections(merged)

            for (const conn of merged) {
                if (conn.status !== 'connected') { continue }
                const isConnected = await window.electron.ssh.isConnected(conn.id)
                if (!isConnected) {
                    updateConnectionStatus(conn.id, 'disconnected')
                }
            }
        } catch (e) {
            console.error('Failed to load connections:', e)
        }
    }, [updateConnectionStatus])

    useEffect(() => {
        if (!isOpen) {return}

        const init = async () => {
            await loadConnections()
        }
        void init().catch(e => console.error('SSH init error:', e))

        const onConnected = (id: string) => {
            updateConnectionStatus(id, 'connected')
            setIsConnecting(false)
            setSelectedConnectionId(id)
            void window.electron.ssh.shellStart(id)
        }

        const onDisconnected = (id: string) => {
            updateConnectionStatus(id, 'disconnected')
            if (selectedConnectionId === id) { setSelectedConnectionId(null) }
        }

        window.electron.ssh.onConnected(onConnected)
        window.electron.ssh.onDisconnected(onDisconnected)

        return () => {
            window.electron.ssh.removeAllListeners()
        }
    }, [isOpen, loadConnections, updateConnectionStatus, selectedConnectionId])

    return {
        connections,
        setConnections,
        isConnecting,
        setIsConnecting,
        selectedConnectionId,
        setSelectedConnectionId,
        loadConnections,
        updateConnectionStatus
    }
}
