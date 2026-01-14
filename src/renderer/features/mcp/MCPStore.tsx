/**
 * MCP Tool Store Component
 * Browse, install, and manage Model Context Protocol tools/servers.
 */

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
    Search, Download, Check, Star, Plug,
    Server, Database, Code, FileText, Globe, Terminal,
    Zap, Shield, Settings
} from 'lucide-react'

interface MCPTool {
    id: string
    name: string
    description: string
    author: string
    version: string
    category: 'filesystem' | 'database' | 'api' | 'development' | 'utility' | 'ai'
    icon: React.ReactNode
    features: string[]
    downloads: number
    rating: number
    isInstalled?: boolean
    isOfficial?: boolean
    configSchema?: Record<string, unknown>
    repositoryUrl?: string
}

const MCP_TOOLS: MCPTool[] = [
    {
        id: 'filesystem',
        name: 'Filesystem',
        description: 'Read, write, and manage files and directories on your system',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'filesystem',
        icon: <FileText className="w-5 h-5" />,
        features: ['Read files', 'Write files', 'List directories', 'Search files', 'Watch for changes'],
        downloads: 50000,
        rating: 4.9,
        isInstalled: true,
        isOfficial: true
    },
    {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Connect to PostgreSQL databases, run queries, and manage schemas',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'database',
        icon: <Database className="w-5 h-5" />,
        features: ['SQL queries', 'Schema inspection', 'Data export', 'Connection pooling'],
        downloads: 35000,
        rating: 4.8,
        isInstalled: false,
        isOfficial: true
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Interact with GitHub repositories, issues, PRs, and more',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'api',
        icon: <Code className="w-5 h-5" />,
        features: ['Repository management', 'Issue tracking', 'PR reviews', 'Code search'],
        downloads: 42000,
        rating: 4.7,
        isInstalled: true,
        isOfficial: true
    },
    {
        id: 'brave-search',
        name: 'Brave Search',
        description: 'Search the web using Brave Search API',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'api',
        icon: <Globe className="w-5 h-5" />,
        features: ['Web search', 'News search', 'Image search', 'Safe search'],
        downloads: 28000,
        rating: 4.6,
        isInstalled: false,
        isOfficial: true
    },
    {
        id: 'puppeteer',
        name: 'Puppeteer',
        description: 'Control headless Chrome for web scraping and automation',
        author: 'Community',
        version: '0.8.0',
        category: 'development',
        icon: <Terminal className="w-5 h-5" />,
        features: ['Page navigation', 'Screenshot capture', 'PDF generation', 'Form automation'],
        downloads: 22000,
        rating: 4.5,
        isInstalled: false,
        isOfficial: false
    },
    {
        id: 'sqlite',
        name: 'SQLite',
        description: 'Work with SQLite databases locally',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'database',
        icon: <Database className="w-5 h-5" />,
        features: ['Local database', 'Fast queries', 'In-memory mode', 'FTS5 search'],
        downloads: 31000,
        rating: 4.8,
        isInstalled: true,
        isOfficial: true
    },
    {
        id: 'fetch',
        name: 'Fetch',
        description: 'Make HTTP requests to any API endpoint',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'api',
        icon: <Zap className="w-5 h-5" />,
        features: ['GET/POST/PUT/DELETE', 'Custom headers', 'JSON parsing', 'Form data'],
        downloads: 45000,
        rating: 4.9,
        isInstalled: false,
        isOfficial: true
    },
    {
        id: 'memory',
        name: 'Memory',
        description: 'Persistent memory storage for conversations',
        author: 'Anthropic',
        version: '1.0.0',
        category: 'ai',
        icon: <Server className="w-5 h-5" />,
        features: ['Key-value storage', 'Entity extraction', 'Context retrieval', 'Auto-summarize'],
        downloads: 38000,
        rating: 4.7,
        isInstalled: false,
        isOfficial: true
    }
]

const CATEGORIES = [
    { id: 'all', label: 'All Tools', icon: Plug },
    { id: 'filesystem', label: 'Filesystem', icon: FileText },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'api', label: 'APIs', icon: Globe },
    { id: 'development', label: 'Development', icon: Code },
    { id: 'ai', label: 'AI', icon: Zap }
]

interface MCPStoreProps {
    onInstall?: (toolId: string) => void
    onUninstall?: (toolId: string) => void
    onConfigure?: (toolId: string) => void
}

export const MCPStore: React.FC<MCPStoreProps> = ({
    onInstall,
    onUninstall,
    onConfigure
}) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)

    const filteredTools = useMemo(() => {
        let tools = MCP_TOOLS

        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            tools = tools.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.features.some(f => f.toLowerCase().includes(q))
            )
        }

        if (selectedCategory !== 'all') {
            tools = tools.filter(t => t.category === selectedCategory)
        }

        return tools
    }, [searchQuery, selectedCategory])

    const installedCount = MCP_TOOLS.filter(t => t.isInstalled).length

    const ToolCard = ({ tool }: { tool: MCPTool }) => (
        <div
            onClick={() => setSelectedTool(tool)}
            className={cn(
                "group p-4 rounded-xl border transition-all cursor-pointer",
                tool.isInstalled
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/30 hover:border-border/60 bg-card/30"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "p-2.5 rounded-lg",
                    tool.isInstalled ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                )}>
                    {tool.icon}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                        {tool.isOfficial && (
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                        )}
                        {tool.isInstalled && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{tool.description}</p>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                        <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {tool.rating}
                        </span>
                        <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {tool.downloads.toLocaleString()}
                        </span>
                        <span>v{tool.version}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
                {tool.isInstalled ? (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfigure?.(tool.id) }}
                            className="flex-1 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted text-foreground rounded-md transition-colors flex items-center justify-center gap-1"
                        >
                            <Settings className="w-3 h-3" /> Configure
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUninstall?.(tool.id) }}
                            className="px-3 py-1.5 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                        >
                            Remove
                        </button>
                    </>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onInstall?.(tool.id) }}
                        className="flex-1 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors flex items-center justify-center gap-1"
                    >
                        <Download className="w-3 h-3" /> Install
                    </button>
                )}
            </div>
        </div>
    )

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border/30">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Plug className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">MCP Tool Store</h1>
                        <p className="text-xs text-muted-foreground">
                            {installedCount} tools installed • Browse Model Context Protocol servers
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50"
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setSelectedCategory(id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                                selectedCategory === id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tool Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTools.map(tool => (
                        <ToolCard key={tool.id} tool={tool} />
                    ))}
                </div>

                {filteredTools.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                        <Plug className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">No tools found</p>
                    </div>
                )}
            </div>

            {/* Tool Detail Modal */}
            {selectedTool && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setSelectedTool(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-card rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
                    >
                        <div className="p-4 border-b border-border/30 flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                {selectedTool.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold">{selectedTool.name}</h2>
                                    {selectedTool.isOfficial && (
                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full">
                                            Official
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">by {selectedTool.author} • v{selectedTool.version}</p>
                            </div>
                        </div>

                        <div className="p-4">
                            <p className="text-sm mb-4">{selectedTool.description}</p>

                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features</h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedTool.features.map((feature, i) => (
                                    <span key={i} className="px-2 py-1 bg-muted/50 text-xs rounded-md">
                                        {feature}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                                <span className="flex items-center gap-1">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    {selectedTool.rating} rating
                                </span>
                                <span className="flex items-center gap-1">
                                    <Download className="w-4 h-4" />
                                    {selectedTool.downloads.toLocaleString()} downloads
                                </span>
                            </div>

                            <div className="flex gap-2">
                                {selectedTool.isInstalled ? (
                                    <>
                                        <button
                                            onClick={() => { onConfigure?.(selectedTool.id); setSelectedTool(null) }}
                                            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"
                                        >
                                            <Settings className="w-4 h-4" /> Configure
                                        </button>
                                        <button
                                            onClick={() => { onUninstall?.(selectedTool.id); setSelectedTool(null) }}
                                            className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium text-sm hover:bg-destructive/20"
                                        >
                                            Uninstall
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => { onInstall?.(selectedTool.id); setSelectedTool(null) }}
                                        className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Install Tool
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedTool(null)}
                                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium text-sm hover:bg-muted/80"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default MCPStore
