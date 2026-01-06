import { useState, useEffect } from 'react'
import { Box, RefreshCw, Play, Square, Trash2, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContainerInfo {
    id: string
    name: string
    image: string
    status: string
    state: 'running' | 'exited' | 'paused' | 'created'
    ports: string
    created: string
}

interface DockerDashboardProps {
    isOpen?: boolean
    onOpenTerminal?: (name: string, command: string) => void
}

export function DockerDashboard({ isOpen = true, onOpenTerminal }: DockerDashboardProps) {
    const [containers, setContainers] = useState<ContainerInfo[]>([])
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
    const [logs, setLogs] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadContainers = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Execute docker ps -a --format json
            const result = await window.electron.runCommand('docker', [
                'ps', '-a', '--format', '{{json .}}'
            ], process.cwd())

            if (result.stderr && !result.stdout) {
                setError('Docker is not running or not installed')
                return
            }

            const lines = (result.stdout || '').trim().split('\n').filter(Boolean)
            const parsed = lines.map((line: string) => {
                try {
                    const data = JSON.parse(line)
                    return {
                        id: data.ID,
                        name: data.Names,
                        image: data.Image,
                        status: data.Status,
                        state: data.State?.toLowerCase() || 'unknown',
                        ports: data.Ports || '',
                        created: data.CreatedAt
                    }
                } catch {
                    return null
                }
            }).filter(Boolean) as ContainerInfo[]

            setContainers(parsed)
        } catch (err: any) {
            setError(err.message || 'Failed to load containers')
        } finally {
            setIsLoading(false)
        }
    }

    const loadLogs = async (containerId: string) => {
        try {
            const result = await window.electron.runCommand('docker', [
                'logs', '--tail', '100', containerId
            ], process.cwd())

            setLogs(result.stdout || result.stderr || 'No logs available')
        } catch (err: any) {
            setLogs(`Error: ${err.message}`)
        }
    }

    const containerAction = async (action: 'start' | 'stop' | 'rm', containerId: string) => {
        try {
            await window.electron.runCommand('docker', [action, containerId], process.cwd())
            await loadContainers()
        } catch (err: any) {
            setError(err.message)
        }
    }

    useEffect(() => {
        if (isOpen) {
            loadContainers()
        }
    }, [isOpen])

    useEffect(() => {
        if (selectedContainer) {
            loadLogs(selectedContainer)
        }
    }, [selectedContainer])

    const getStateColor = (state: string) => {
        switch (state) {
            case 'running': return 'text-green-400 bg-green-500/20'
            case 'exited': return 'text-red-400 bg-red-500/20'
            case 'paused': return 'text-yellow-400 bg-yellow-500/20'
            default: return 'text-zinc-400 bg-zinc-500/20'
        }
    }

    if (!isOpen) return null

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-zinc-900 to-black">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                        <Box size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-white">Docker Dashboard</h2>
                        <p className="text-xs text-zinc-500">{containers.length} containers</p>
                    </div>
                </div>
                <button
                    onClick={loadContainers}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                >
                    <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Container List */}
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/2 border-r border-white/5 overflow-y-auto p-4 space-y-2">
                    {containers.length === 0 && !isLoading && (
                        <div className="text-center text-zinc-500 text-sm py-8">
                            No containers found
                        </div>
                    )}
                    {containers.map((container) => (
                        <div
                            key={container.id}
                            onClick={() => setSelectedContainer(container.id)}
                            className={cn(
                                "p-3 rounded-xl border cursor-pointer transition-all",
                                selectedContainer === container.id
                                    ? "bg-blue-500/10 border-blue-500/30"
                                    : "bg-white/5 border-white/10 hover:bg-white/10"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-white text-sm truncate">
                                    {container.name}
                                </span>
                                <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full capitalize",
                                    getStateColor(container.state)
                                )}>
                                    {container.state}
                                </span>
                            </div>
                            <div className="text-xs text-zinc-500 truncate">{container.image}</div>
                            {container.ports && (
                                <div className="text-xs text-zinc-600 mt-1 truncate">{container.ports}</div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-1 mt-2">
                                {container.state === 'running' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); containerAction('stop', container.id) }}
                                        className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                                        title="Stop"
                                    >
                                        <Square size={14} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); containerAction('start', container.id) }}
                                        className="p-1.5 rounded hover:bg-green-500/20 text-zinc-400 hover:text-green-400"
                                        title="Start"
                                    >
                                        <Play size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); containerAction('rm', container.id) }}
                                    className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                                    title="Remove"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenTerminal?.(`Docker: ${container.name}`, `docker exec -it ${container.id} /bin/sh`)
                                    }}
                                    className="p-1.5 rounded hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400"
                                    title="Shell"
                                >
                                    <Terminal size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Logs Panel */}
                <div className="w-1/2 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/5 flex items-center gap-2">
                        <Terminal size={14} className="text-zinc-400" />
                        <span className="text-sm text-zinc-400">Logs</span>
                    </div>
                    <pre className="flex-1 p-4 text-xs font-mono text-zinc-400 overflow-y-auto whitespace-pre-wrap">
                        {selectedContainer ? logs || 'Loading...' : 'Select a container to view logs'}
                    </pre>
                </div>
            </div>
        </div>
    )
}
