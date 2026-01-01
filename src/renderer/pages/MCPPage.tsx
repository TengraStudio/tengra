import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Puzzle,
    Plus,
    Trash2,
    Power,
    PowerOff,
    ChevronDown,
    ChevronRight,
    Wrench
} from 'lucide-react'

interface MCPServer {
    id: string
    name: string
    command: string
    args?: string[]
    enabled: boolean
    status: 'connected' | 'disconnected' | 'connecting' | 'error'
    tools?: { name: string; description?: string }[]
}

interface MCPPageProps {
    // Props will be connected to actual MCP service
}

export function MCPPage({ }: MCPPageProps) {
    const [servers, setServers] = useState<MCPServer[]>([
        {
            id: '1',
            name: 'Filesystem',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
            enabled: true,
            status: 'connected',
            tools: [
                { name: 'read_file', description: 'Read contents of a file' },
                { name: 'write_file', description: 'Write contents to a file' },
                { name: 'list_directory', description: 'List directory contents' },
            ]
        },
        {
            id: '2',
            name: 'Git',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-git'],
            enabled: false,
            status: 'disconnected',
            tools: []
        }
    ])
    const [expandedServer, setExpandedServer] = useState<string | null>('1')
    const [showAddModal, setShowAddModal] = useState(false)

    const handleToggleServer = (serverId: string) => {
        setServers(prev => prev.map(s =>
            s.id === serverId
                ? {
                    ...s,
                    enabled: !s.enabled,
                    status: !s.enabled ? 'connecting' : 'disconnected'
                }
                : s
        ))

        // Simulate connection
        setTimeout(() => {
            setServers(prev => prev.map(s =>
                s.id === serverId && s.enabled
                    ? { ...s, status: 'connected' }
                    : s
            ))
        }, 1000)
    }

    const handleDeleteServer = (serverId: string) => {
        if (confirm('Bu MCP sunucusunu silmek istediğinize emin misiniz?')) {
            setServers(prev => prev.filter(s => s.id !== serverId))
        }
    }

    const statusColors = {
        connected: 'bg-accent',
        disconnected: 'bg-muted-foreground',
        connecting: 'bg-yellow-500 animate-pulse',
        error: 'bg-destructive'
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-card/30">
                <div>
                    <h1 className="text-lg font-semibold">MCP Sunucuları</h1>
                    <p className="text-xs text-muted-foreground">Model Context Protocol</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>Sunucu Ekle</span>
                </button>
            </header>

            {/* Server List */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3 max-w-3xl">
                    {servers.map((server, index) => (
                        <motion.div
                            key={server.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="glass-card overflow-hidden"
                        >
                            {/* Server Header */}
                            <div
                                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5"
                                onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                            >
                                <div className={cn("w-2 h-2 rounded-full", statusColors[server.status])} />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Puzzle className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-sm">{server.name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                                        {server.command} {server.args?.join(' ')}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleServer(server.id) }}
                                        className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            server.enabled
                                                ? "bg-accent/20 text-accent hover:bg-accent/30"
                                                : "bg-muted text-muted-foreground hover:bg-white/10"
                                        )}
                                    >
                                        {server.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteServer(server.id) }}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {expandedServer === server.id
                                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    }
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedServer === server.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-border/50 p-4 bg-background/50"
                                >
                                    {server.tools && server.tools.length > 0 ? (
                                        <div>
                                            <h4 className="section-title flex items-center gap-2">
                                                <Wrench className="w-3.5 h-3.5" />
                                                Araçlar ({server.tools.length})
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {server.tools.map(tool => (
                                                    <div
                                                        key={tool.name}
                                                        className="p-3 bg-card rounded-lg border border-border/30"
                                                    >
                                                        <p className="text-sm font-mono font-medium">{tool.name}</p>
                                                        {tool.description && (
                                                            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            {server.status === 'connected'
                                                ? 'Bu sunucuda araç bulunamadı'
                                                : 'Araçları görmek için sunucuyu bağlayın'}
                                        </p>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    ))}

                    {servers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Puzzle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground mb-4">Henüz MCP sunucusu eklenmedi</p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn-primary"
                            >
                                İlk Sunucuyu Ekle
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Server Modal - Placeholder */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl p-6 w-full max-w-md"
                    >
                        <h2 className="text-lg font-semibold mb-4">MCP Sunucusu Ekle</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground">Sunucu Adı</label>
                                <input type="text" className="input-field w-full mt-1" placeholder="My Server" />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Komut</label>
                                <input type="text" className="input-field w-full mt-1" placeholder="npx" />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Argümanlar (opsiyonel)</label>
                                <input type="text" className="input-field w-full mt-1" placeholder="-y @modelcontextprotocol/server-filesystem" />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 btn-ghost"
                            >
                                İptal
                            </button>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 btn-primary"
                            >
                                Ekle
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
