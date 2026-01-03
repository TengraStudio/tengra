
import { useMemo, useState, useEffect } from 'react'
import { useTranslation, Language } from '../i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Puzzle,
    Plus,
    Trash2,
    Power,
    PowerOff,
    ChevronDown,
    Wrench,
    Search,
    Github,
    Database,
    MessageSquare,
    Eye,
    Store,
    Layout,
    AlertCircle,
    Info,
    GripVertical,
    LayoutGrid,
    List,
    ChevronLeft
} from 'lucide-react'
import { MARKETPLACE_MCP_DATA } from '@/data/mcp-marketplace'

const FEATURED_MCPS = [
    {
        id: 'google-search',
        name: 'Google Search',
        description: 'Real-time web results and indexing.',
        category: 'Search',
        author: 'Google',
        icon: Search,
        command: 'npx -y @modelcontextprotocol/server-google-search',
        tools: [
            { name: 'google_search', description: 'Search the web using Google' },
            { name: 'list_results', description: 'Get detailed search results' }
        ]
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Browse repositories, manage issues, and PRs.',
        category: 'DevTools',
        author: 'MCP Community',
        icon: Github,
        command: 'npx -y @modelcontextprotocol/server-github',
        tools: [
            { name: 'list_repos', description: 'List repositories for a user' },
            { name: 'get_issue', description: 'Get details of a specific issue' },
            { name: 'create_pr', description: 'Create a new pull request' }
        ]
    },
    {
        id: 'slack',
        name: 'Slack',
        description: 'Full Slack workspace integration.',
        category: 'Communication',
        author: 'Slack',
        icon: MessageSquare,
        command: 'npx -y @modelcontextprotocol/server-slack',
        tools: [
            { name: 'post_message', description: 'Post a message to a channel' },
            { name: 'list_channels', description: 'List available Slack channels' }
        ]
    },
    {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Query and manage SQL databases.',
        category: 'Database',
        author: 'MCP SDK',
        icon: Database,
        command: 'npx -y @modelcontextprotocol/server-postgres',
        tools: [
            { name: 'query', description: 'Execute a SQL query' },
            { name: 'list_tables', description: 'List tables in the database' }
        ]
    },
    {
        id: 'puppeteer',
        name: 'Puppeteer',
        description: 'Browser automation and web scraping.',
        category: 'Automation',
        author: 'Google',
        icon: Eye,
        command: 'npx -y @modelcontextprotocol/server-puppeteer',
        tools: [
            { name: 'navigate', description: 'Navigate to a URL' },
            { name: 'screenshot', description: 'Take a screenshot of the page' },
            { name: 'click', description: 'Click an element on the page' }
        ]
    }
]

interface MCPServer {
    id: string
    name: string
    description: string
    status: 'connected' | 'disconnected' | 'error'
    isEnabled: boolean
    source: 'core' | 'user'
    command?: string
    args?: string[]
    tools: { name: string; description: string }[]
}

interface MCPPageProps {
    language?: Language
    embedded?: boolean
    activeTab?: 'servers' | 'marketplace'
}

export function MCPPage({ language = 'tr', embedded = false, activeTab: externalTab }: MCPPageProps) {
    const { t } = useTranslation(language)
    const [servers, setServers] = useState<MCPServer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedServer, setExpandedServer] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [internalTab, setInternalTab] = useState<'servers' | 'marketplace'>('servers')
    const activeTab = embedded ? (externalTab || 'servers') : internalTab
    const setActiveTab = (tab: 'servers' | 'marketplace') => {
        if (embedded) return
        setInternalTab(tab)
    }
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 30

    useEffect(() => {
        loadServers()
    }, [])

    const loadServers = async () => {
        try {
            setIsLoading(true)
            const list = await window.electron.mcp.list()
            const formatted: MCPServer[] = list.map((s: any) => ({
                id: s.name,
                name: s.name,
                description: s.description,
                status: (s.isEnabled ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
                isEnabled: s.isEnabled,
                source: s.source || 'core',
                tools: s.actions || []
            }))
            setServers(formatted)
        } catch (error) {
            console.error('Failed to load MCP servers:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const marketplaceEntries = useMemo(() => {
        const combined = [
            ...FEATURED_MCPS,
            ...MARKETPLACE_MCP_DATA.map((entry) => ({ ...entry, icon: Store }))
        ]
        const seen = new Set<string>()
        const deduped: typeof combined = []
        for (const entry of combined) {
            if (seen.has(entry.id)) continue
            seen.add(entry.id)
            deduped.push(entry)
        }
        return deduped
    }, [])

    const filteredMarketplace = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const installedServerNames = new Set(servers.map(s => s.name))

        // Filter out already installed servers
        const availableEntries = marketplaceEntries.filter(m => !installedServerNames.has(m.name))

        const filtered = query
            ? availableEntries.filter((entry) => {
                const haystack = `${entry.name} ${entry.description} ${entry.category} ${entry.author || ''}`.toLowerCase()
                return haystack.includes(query)
            })
            : availableEntries

        // Reset to first page when filtering
        return filtered
    }, [marketplaceEntries, searchQuery, servers])

    // Update pagination when filtered list changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    const totalPages = Math.ceil(filteredMarketplace.length / itemsPerPage)
    const paginatedMarketplace = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredMarketplace.slice(start, start + itemsPerPage)
    }, [filteredMarketplace, currentPage])

    const handleToggleServer = async (serverId: string) => {
        const server = servers.find(s => s.id === serverId)
        if (!server) return

        try {
            const newState = !server.isEnabled
            await window.electron.mcp.toggle(serverId, newState)
            setServers(prev => prev.map(s =>
                s.id === serverId ? { ...s, isEnabled: newState, status: newState ? 'connected' : 'disconnected' } : s
            ))
        } catch (error) {
            console.error('Failed to toggle MCP server:', error)
        }
    }

    const handleInstall = async (mcp: any) => {
        try {
            const config = {
                name: mcp.name,
                command: mcp.command.split(' ')[0],
                args: mcp.command.split(' ').slice(1),
                description: mcp.description,
                env: mcp.env || {},
                tools: mcp.tools || []
            }

            const result = await window.electron.mcp.install(config)
            if (result.success) {
                // Refresh list
                await loadServers()
                // Done - no redirection as requested
            } else {
                alert(`Kurulum başarısız: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to install MCP server:', error)
        }
    }

    const handleDeleteServer = async (serverId: string) => {
        if (confirm('Bu MCP sunucusunu silmek istediğinize emin misiniz?')) {
            try {
                // For user servers, we need to uninstall
                const server = servers.find(s => s.id === serverId)
                if (server?.source === 'user') {
                    await window.electron.mcp.uninstall(serverId)
                } else {
                    // For core servers, we just toggle it off if it's "deleted"
                    // But in this logic, we probably just want to disable it
                    await window.electron.mcp.toggle(serverId, false)
                }
                await loadServers()
            } catch (error) {
                console.error('Failed to delete/uninstall server:', error)
            }
        }
    }

    const coreServers = useMemo(() => servers.filter(s => s.source === 'core'), [servers])
    const installedServers = useMemo(() => servers.filter(s => s.source === 'user'), [servers])

    const statusColors = {
        connected: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
        disconnected: 'bg-zinc-500',
        error: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
    }

    return (
        <div className={cn("w-full flex flex-col", embedded ? "bg-transparent" : "flex-1 h-full bg-background overflow-hidden")}>
            {!embedded && (
                <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 bg-card/10 backdrop-blur-md z-30 shrink-0">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20">
                                <Puzzle className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold tracking-tight">{t('mcp.management') || 'MCP Yonetimi'}</h1>
                                <p className="text-sm text-muted-foreground font-medium uppercase tracking-[0.2em] opacity-50">Model Context Protocol</p>
                            </div>
                        </div>

                        <nav className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl border border-border/50">
                            <button
                                onClick={() => setActiveTab('servers')}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                    activeTab === 'servers'
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Layout className="w-3.5 h-3.5" />
                                    {t('mcp.myServers') || 'Sunucularim'}
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('marketplace')}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                    activeTab === 'marketplace'
                                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <Store className="w-3.5 h-3.5" />
                                    {t('mcp.marketplace') || 'Marketplace'}
                                </div>
                            </button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'marketplace' && (
                            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5 mr-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all",
                                        viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all",
                                        viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    <List className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {activeTab === 'servers' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-primary/10"
                            >
                                <Plus className="w-4 h-4" />
                                <span>{t('mcp.addServer') || 'Sunucu Ekle'}</span>
                            </button>
                        )}
                    </div>
                </header>
            )}

            <div className={cn("flex-1 relative flex flex-col", embedded ? "overflow-visible" : "overflow-hidden")}>
                <AnimatePresence mode="wait">
                    {activeTab === 'servers' ? (
                        <motion.div
                            key="servers"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className={cn("flex-1", embedded ? "px-0 py-0" : "overflow-y-auto custom-scrollbar p-4 sm:p-6")}
                        >
                            <div className={cn("mx-auto space-y-8", embedded ? "max-w-5xl pb-6" : "max-w-4xl pb-10")}>
                                {embedded && (
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-sm font-bold text-white">{t('mcp.myServers') || 'Sunucularim'}</h2>
                                            <p className="text-xs text-muted-foreground">Model Context Protocol servisleri</p>
                                        </div>
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-primary/10"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>{t('mcp.addServer') || 'Sunucu Ekle'}</span>
                                        </button>
                                    </div>
                                )}
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                            <Puzzle className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                        </div>
                                        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Servisler taraniyor...</p>
                                    </div>
                                ) : (
                                    <>
                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{t('mcp.systemServers') || 'Sistem Servisleri'}</h2>
                                                <div className="h-[1px] flex-1 bg-white/5 mx-4" />
                                                <span className="text-sm font-bold text-primary/40 leading-none">{coreServers.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                {coreServers.map((server, idx) => (
                                                    <ServerCard
                                                        key={server.id}
                                                        server={server}
                                                        index={idx}
                                                        expandedServer={expandedServer}
                                                        setExpandedServer={setExpandedServer}
                                                        handleToggleServer={handleToggleServer}
                                                        handleDeleteServer={handleDeleteServer}
                                                        statusColors={statusColors}
                                                    />
                                                ))}
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{t('mcp.installedServers') || 'Marketplace / Kurulan'}</h2>
                                                <div className="h-[1px] flex-1 bg-white/5 mx-4" />
                                                <span className="text-sm font-bold text-emerald-500/40 leading-none">{installedServers.length}</span>
                                            </div>

                                            {installedServers.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {installedServers.map((server, idx) => (
                                                        <ServerCard
                                                            key={server.id}
                                                            server={server}
                                                            index={idx}
                                                            expandedServer={expandedServer}
                                                            setExpandedServer={setExpandedServer}
                                                            handleToggleServer={handleToggleServer}
                                                            handleDeleteServer={handleDeleteServer}
                                                            statusColors={statusColors}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-10 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center opacity-40 grayscale group hover:grayscale-0 hover:opacity-70 transition-all">
                                                    <Store className="w-8 h-8 mb-3 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                                                    <p className="text-xs font-medium text-zinc-500">Henuz marketten bir servis kurulmadi.</p>
                                                    {!embedded && (
                                                        <button
                                                            onClick={() => setActiveTab('marketplace')}
                                                            className="mt-4 text-sm font-black uppercase tracking-widest text-emerald-500 hover:underline"
                                                        >
                                                            {t('mcp.discoverMarket') || 'Market Kesfet'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </section>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="marketplace"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={cn("flex-1 flex flex-col min-h-0", embedded ? "" : "bg-background/50")}
                        >
                            <div className={cn("flex flex-wrap items-center justify-between gap-4", embedded ? "pb-4" : "px-8 py-6 border-b border-white/5 bg-black/20 shrink-0")}>
                                <div>
                                    <h2 className={cn("font-black tracking-tight text-foreground flex items-center gap-3", embedded ? "text-base" : "text-xl mb-1")}>
                                        {t('mcp.marketplace') || 'Marketplace'}
                                        {!embedded && (
                                            <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-sm rounded-full border border-emerald-500/20">Beta</div>
                                        )}
                                    </h2>
                                    <p className="text-xs text-zinc-500 font-medium">{t('mcp.marketplaceSubtitle') || 'Platforma yeni yetenekler kazandiracak binlerce servisi kesfedin.'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {embedded && (
                                        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={cn(
                                                    "p-1.5 rounded-md transition-all",
                                                    viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground"
                                                )}
                                            >
                                                <LayoutGrid className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={cn(
                                                    "p-1.5 rounded-md transition-all",
                                                    viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground"
                                                )}
                                            >
                                                <List className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="relative group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t('mcp.searchPlaceholder') || 'Servis veya arac kesfet...'}
                                            className="h-10 w-72 bg-muted/20 border border-border/50 rounded-xl pl-10 pr-4 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:bg-muted/30 transition-all font-medium placeholder:text-muted-foreground/60"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={cn("flex-1", embedded ? "" : "overflow-y-auto custom-scrollbar")}>
                                <div className={cn("mx-auto", embedded ? "max-w-6xl" : "max-w-7xl", embedded ? "pb-4" : "p-6 sm:p-8")}>
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {paginatedMarketplace.map((mcp, idx) => (
                                                <MarketplaceGridCard key={mcp.id} mcp={mcp} index={idx} onInstall={() => handleInstall(mcp)} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {paginatedMarketplace.map((mcp, idx) => (
                                                <MarketplaceListCard key={mcp.id} mcp={mcp} index={idx} onInstall={() => handleInstall(mcp)} />
                                            ))}
                                        </div>
                                    )}

                                    {filteredMarketplace.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
                                            <Search className="w-12 h-12 mb-4 text-zinc-600" />
                                            <h3 className="text-sm font-bold text-foreground">Sonuc bulunamadi</h3>
                                            <p className="text-xs text-zinc-500 mt-1 max-w-[200px]">"{searchQuery}" aramasina uygun bir MCP servisi bulamadik.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {totalPages > 1 && (
                                <div className={cn("mt-6 flex items-center justify-center gap-2", embedded ? "" : "px-8 py-6 border-t border-white/5 bg-black/20")}>
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-white/5">
                                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                            let pageNum = currentPage
                                            if (currentPage <= 3) pageNum = i + 1
                                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                                            else pageNum = currentPage - 2 + i

                                            if (pageNum < 1 || pageNum > totalPages) return null

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={cn(
                                                        "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                                                        currentPage === pageNum
                                                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    {pageNum}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all rotate-180"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>

                                    <div className="ml-4 text-xs font-bold text-zinc-600 uppercase tracking-widest">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showAddModal && <AddServerModal onClose={() => setShowAddModal(false)} />}
            </AnimatePresence>
        </div>
    )
}

function ServerCard({ server, index, expandedServer, setExpandedServer, handleToggleServer, handleDeleteServer, statusColors }: any) {
    const isExpanded = expandedServer === server.id;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
                "group relative border transition-all duration-300 overflow-hidden",
                isExpanded
                    ? "bg-card/40 border-primary/30 rounded-2xl shadow-xl shadow-black/40 ring-1 ring-primary/5"
                    : "bg-card/20 border-white/5 rounded-xl hover:border-white/10 hover:bg-card/30"
            )}
        >
            <div
                className="flex items-center gap-4 p-4 cursor-pointer select-none"
                onClick={() => setExpandedServer(isExpanded ? null : server.id)}
            >
                {/* Drag handle placeholder */}
                <div className="opacity-0 group-hover:opacity-20 transition-opacity">
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Status indicator */}
                <div className="relative">
                    <div className={cn("w-2.5 h-2.5 rounded-full z-10 relative", statusColors[server.status])} />
                    {server.status === 'connected' && (
                        <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tracking-tight text-white">{server.name}</span>
                        {server.source === 'core' && (
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-primary/10 text-primary text-xs font-black border border-primary/20 uppercase">System</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 opacity-70 font-medium">
                        {server.description}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-black/30 rounded-xl border border-white/5 p-1 h-9">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleToggleServer(server.id) }}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all duration-300",
                                server.isEnabled
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white"
                            )}
                        >
                            {server.isEnabled ? (
                                <>
                                    <Power className="w-3 h-3" />
                                    <span>Aktif</span>
                                </>
                            ) : (
                                <>
                                    <PowerOff className="w-3 h-3" />
                                    <span>Devre Dışı</span>
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteServer(server.id) }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className={cn("w-8 h-8 flex items-center justify-center transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
                        <ChevronDown className="w-4 h-4 text-zinc-600" />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                    >
                        <div className="p-5 space-y-5">
                            {/* Actions / Tools */}
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">
                                    <Wrench className="w-3 h-3" />
                                    Kullanılabilir Araçlar ({server.tools.length})
                                </h4>
                                {server.tools.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {server.tools.map((tool: any) => (
                                            <div
                                                key={tool.name}
                                                className="p-3 bg-white/[0.03] border border-white/5 rounded-xl group/tool hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-help"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold text-primary/80 font-mono tracking-tight">{tool.name}</span>
                                                    <Info className="w-3 h-3 text-zinc-600 opacity-0 group-hover/tool:opacity-100 transition-opacity" />
                                                </div>
                                                <p className="text-sm text-zinc-500 font-medium leading-relaxed italic">
                                                    {tool.description || 'Açıklama mevcut değil.'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 bg-black/20 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center opacity-40">
                                        <AlertCircle className="w-6 h-6 mb-2" />
                                        <p className="text-sm font-bold uppercase tracking-widest text-zinc-600">Araç bulunamadı</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function MarketplaceGridCard({ mcp, index, onInstall }: any) {
    const Icon = mcp.icon || Puzzle;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            className="group relative bg-card/40 border border-border/50 p-5 rounded-2xl flex flex-col hover:border-emerald-500/30 hover:bg-card/60 transition-all duration-300 shadow-xl shadow-black/20"
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.07] transition-opacity">
                <Icon className="w-24 h-24" />
            </div>

            <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 group-hover:scale-110 transition-all duration-300">
                    <Icon className="w-6 h-6 text-emerald-500/80" />
                </div>
                <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm tracking-tight truncate">{mcp.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-emerald-500 font-black tracking-widest uppercase opacity-70">{mcp.author}</span>
                    </div>
                </div>
            </div>

            <p className="text-sm font-medium text-zinc-500 leading-relaxed line-clamp-2 mb-4 group-hover:text-zinc-400 transition-colors">
                {mcp.description}
            </p>

            {/* Tools Insight */}
            {mcp.tools && mcp.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                    {mcp.tools.slice(0, 3).map((t: any) => (
                        <span key={t.name} className="px-1.5 py-0.5 rounded-md bg-emerald-500/5 text-emerald-500/60 text-xs font-bold border border-emerald-500/10">
                            {t.name}
                        </span>
                    ))}
                    {mcp.tools.length > 3 && (
                        <span className="text-xs font-bold text-zinc-600 pl-1">+{mcp.tools.length - 3}</span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                <div className="px-2 py-0.5 rounded-md bg-white/5 text-xs font-black text-zinc-600 uppercase tracking-widest">
                    {mcp.category}
                </div>
                <button
                    onClick={onInstall}
                    className="h-8 px-4 bg-emerald-500 text-white rounded-lg text-sm font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-emerald-500/10 transition-all"
                >
                    Kur
                </button>
            </div>
        </motion.div>
    )
}

function MarketplaceListCard({ mcp, index, onInstall }: any) {
    const Icon = mcp.icon || Puzzle;
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.01 }}
            className="group flex items-center gap-6 p-4 bg-card/40 border border-border/50 rounded-xl hover:bg-card/60 hover:border-border transition-all"
        >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-emerald-500/60" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white text-sm truncate">{mcp.name}</h3>
                    <span className="px-2 py-0.5 rounded-[4px] bg-white/5 text-xs font-bold text-zinc-600 uppercase">{mcp.category}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-zinc-500 font-medium truncate">{mcp.description}</p>
                    {mcp.tools && mcp.tools.length > 0 && (
                        <>
                            <div className="w-1 h-1 rounded-full bg-zinc-800" />
                            <div className="flex items-center gap-1">
                                {mcp.tools.slice(0, 2).map((t: any) => (
                                    <span key={t.name} className="text-xs text-emerald-500/50 font-mono italic">{t.name}</span>
                                ))}
                                {mcp.tools.length > 2 && <span className="text-xs text-zinc-700">+{mcp.tools.length - 2}</span>}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-sm font-black text-zinc-600 uppercase tracking-widest mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {mcp.author}
            </div>

            <button
                onClick={onInstall}
                className="h-8 px-5 bg-white/5 border border-white/5 text-emerald-500 rounded-lg text-sm font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shrink-0"
            >
                Hızlı Kur
            </button>
        </motion.div>
    )
}

function AddServerModal({ onClose }: any) {
    const [name, setName] = useState('')
    const [command, setCommand] = useState('')
    const [args, setArgs] = useState('')
    const [env, setEnv] = useState('')

    const handleSave = async () => {
        if (!name || !command) return

        const envObj: Record<string, string> = {}
        env.split('\n').forEach(line => {
            const [k, ...v] = line.split('=')
            if (k && v) {
                envObj[k.trim()] = v.join('=').trim()
            }
        })

        const config = {
            name,
            command,
            args: args.split(' ').filter(a => a.trim().length > 0),
            description: 'Manual Custom Server',
            env: envObj,
            tools: [] // Dynamic tools will be discovered on runtime in future
        }

        try {
            const result = await window.electron.mcp.install(config)
            if (result.success) {
                onClose()
                window.location.reload()
            } else {
                alert('Error: ' + result.error)
            }
        } catch (e: any) {
            alert('Failed: ' + e.message)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-black ring-1 ring-border/5"
            >
                <div className="p-4 sm:p-6 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-lg font-bold text-white flex items-center gap-3 tracking-tight">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-emerald-500" />
                        </div>
                        Yeni MCP Sunucusu
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Özel bir MCP sunucusunu manuel olarak yapılandırın.</p>
                </div>

                <div className="p-4 sm:p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Sunucu İsmi</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-medium placeholder:text-zinc-700"
                            placeholder="Örn: My Custom Service"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Çalıştırma Komutu</label>
                        <div className="relative group">
                            <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                className="w-full h-11 bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-zinc-700"
                                placeholder="npx, python, node..."
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Argümanlar</label>
                        <textarea
                            value={args}
                            onChange={(e) => setArgs(e.target.value)}
                            className="w-full min-h-[80px] bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-zinc-700"
                            placeholder="-y @modelcontextprotocol/server-filesystem /path/to/dir"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Çevre Değişkenleri (ENV)</label>
                        <textarea
                            value={env}
                            onChange={(e) => setEnv(e.target.value)}
                            className="w-full min-h-[80px] bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none placeholder:text-zinc-700"
                            placeholder="GITHUB_TOKEN=ghp_xxx&#10;DB_HOST=localhost"
                        />
                    </div>
                </div>

                <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 h-11 rounded-xl text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all"
                    >
                        Sunucuyu Kaydet
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

function Terminal({ className }: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
    );
}
