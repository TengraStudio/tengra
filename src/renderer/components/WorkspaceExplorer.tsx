import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileCode, FileText, Folder, Plus, RefreshCw, Server, X, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceMount } from '@/types'

export interface WorkspaceEntry {
    mountId: string
    name: string
    path: string
    isDirectory: boolean
}

export interface ContextMenuAction {
    type: 'createFile' | 'createFolder' | 'rename' | 'delete'
    entry: WorkspaceEntry
}

interface WorkspaceExplorerProps {
    mounts: WorkspaceMount[]
    mountStatus: Record<string, 'connected' | 'disconnected' | 'connecting'>
    refreshSignal: number
    onOpenFile: (entry: WorkspaceEntry) => void
    onSelectEntry: (entry: WorkspaceEntry) => void
    selectedEntry?: WorkspaceEntry | null
    onAddMount: () => void
    onRemoveMount: (mountId: string) => void
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean
    onContextAction?: (action: ContextMenuAction) => void
    variant?: 'panel' | 'embedded'
}

interface FileNode {
    name: string
    isDirectory: boolean
    path: string
}

interface ContextMenuState {
    x: number
    y: number
    entry: WorkspaceEntry
}

const getFileIcon = (name: string) => {
    if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode className="w-4 h-4 text-blue-300" />
    if (name.endsWith('.css') || name.endsWith('.scss')) return <FileCode className="w-4 h-4 text-pink-300" />
    if (name.endsWith('.json')) return <FileCode className="w-4 h-4 text-yellow-300" />
    if (name.endsWith('.md')) return <FileText className="w-4 h-4 text-emerald-300" />
    return <FileText className="w-4 h-4 text-zinc-400" />
}

const joinPath = (base: string, name: string, type: WorkspaceMount['type']) => {
    const sep = type === 'ssh' ? '/' : (base.includes('\\') ? '\\' : '/')
    if (base.endsWith(sep)) return `${base}${name}`
    return `${base}${sep}${name}`
}

const sortNodes = (nodes: FileNode[]) => (
    nodes.slice().sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
        return a.isDirectory ? -1 : 1
    })
)

const WorkspaceTreeItem: React.FC<{
    node: FileNode
    mount: WorkspaceMount
    level: number
    refreshSignal: number
    onOpenFile: (entry: WorkspaceEntry) => void
    onSelectEntry: (entry: WorkspaceEntry) => void
    selectedEntry?: WorkspaceEntry | null
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean
    onContextMenu?: (e: React.MouseEvent, entry: WorkspaceEntry) => void
}> = ({ node, mount, level, refreshSignal, onOpenFile, onSelectEntry, selectedEntry, onEnsureMount, onContextMenu }) => {
    const [expanded, setExpanded] = useState(false)
    const [children, setChildren] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    const loadChildren = async () => {
        if (!node.isDirectory) return
        setLoading(true)
        const isReady = onEnsureMount ? await onEnsureMount(mount) : true
        if (!isReady) {
            setLoading(false)
            return
        }
        try {
            const result = mount.type === 'local'
                ? await window.electron.listDirectory(node.path)
                : await window.electron.ssh.listDir(mount.id, node.path)
            if (result?.success && Array.isArray(result.files)) {
                const mapped = result.files.map((item: any) => ({
                    name: item.name,
                    isDirectory: mount.type === 'local' ? Boolean(item.isDirectory) : item.type === 'directory',
                    path: joinPath(node.path, item.name, mount.type)
                }))
                setChildren(sortNodes(mapped))
                setLoaded(true)
            }
        } catch (error) {
            console.error('Failed to load directory', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (expanded) loadChildren()
    }, [expanded, refreshSignal])

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        const entry = { mountId: mount.id, name: node.name, path: node.path, isDirectory: node.isDirectory }
        onSelectEntry(entry)
        if (node.isDirectory) {
            setExpanded((prev) => !prev)
            return
        }
        onOpenFile(entry)
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const entry = { mountId: mount.id, name: node.name, path: node.path, isDirectory: node.isDirectory }
        onSelectEntry(entry)
        onContextMenu?.(e, entry)
    }

    const isSelected = Boolean(
        selectedEntry && selectedEntry.mountId === mount.id && selectedEntry.path === node.path
    )

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all select-none group",
                    isSelected ? "bg-white/10 text-white" : "hover:bg-white/5 text-muted-foreground hover:text-white"
                )}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {node.isDirectory ? (
                    <span className="opacity-70">
                        {loading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        ) : expanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                        )}
                    </span>
                ) : (
                    <span className="w-3.5" />
                )}

                {node.isDirectory
                    ? <Folder className={cn("w-4 h-4 text-blue-400", expanded && "fill-blue-400/20")} />
                    : getFileIcon(node.name)}
                <span className="truncate text-sm font-medium">{node.name}</span>
            </div>

            {expanded && (
                <div className="flex flex-col">
                    {children.map((child) => (
                        <WorkspaceTreeItem
                            key={`${mount.id}:${child.path}`}
                            node={child}
                            mount={mount}
                            level={level + 1}
                            refreshSignal={refreshSignal}
                            onOpenFile={onOpenFile}
                            onSelectEntry={onSelectEntry}
                            selectedEntry={selectedEntry}
                            onEnsureMount={onEnsureMount}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                    {children.length === 0 && loaded && (
                        <div className="text-xs text-zinc-600 pl-8 py-1 italic">Boş klasör</div>
                    )}
                </div>
            )}
        </div>
    )
}

export const WorkspaceExplorer: React.FC<WorkspaceExplorerProps> = ({
    mounts,
    mountStatus,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    onAddMount,
    onRemoveMount,
    selectedEntry,
    onEnsureMount,
    onContextAction,
    variant = 'panel'
}) => {
    const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>({})
    const [rootNodes, setRootNodes] = useState<Record<string, FileNode[]>>({})
    const [loadingMounts, setLoadingMounts] = useState<Record<string, boolean>>({})
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

    const statusLabel = (mount: WorkspaceMount) => {
        if (mount.type !== 'ssh') return 'local'
        return mountStatus[mount.id] || 'disconnected'
    }

    const loadRoot = async (mount: WorkspaceMount) => {
        setLoadingMounts((prev) => ({ ...prev, [mount.id]: true }))
        const isReady = onEnsureMount ? await onEnsureMount(mount) : true
        if (!isReady) {
            setLoadingMounts((prev) => ({ ...prev, [mount.id]: false }))
            return
        }
        try {
            const result = mount.type === 'local'
                ? await window.electron.listDirectory(mount.rootPath)
                : await window.electron.ssh.listDir(mount.id, mount.rootPath)
            if (result?.success && Array.isArray(result.files)) {
                const mapped = result.files.map((item: any) => ({
                    name: item.name,
                    isDirectory: mount.type === 'local' ? Boolean(item.isDirectory) : item.type === 'directory',
                    path: joinPath(mount.rootPath, item.name, mount.type)
                }))
                setRootNodes((prev) => ({ ...prev, [mount.id]: sortNodes(mapped) }))
            }
        } catch (error) {
            console.error('Failed to load mount root', error)
        } finally {
            setLoadingMounts((prev) => ({ ...prev, [mount.id]: false }))
        }
    }

    useEffect(() => {
        mounts.forEach((mount) => {
            if (expandedMounts[mount.id]) {
                loadRoot(mount)
            }
        })
    }, [refreshSignal])

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        if (contextMenu) {
            document.addEventListener('click', handleClick)
            return () => document.removeEventListener('click', handleClick)
        }
    }, [contextMenu])

    const toggleMount = (mount: WorkspaceMount) => {
        setExpandedMounts((prev) => {
            const next = { ...prev, [mount.id]: !prev[mount.id] }
            if (!prev[mount.id]) {
                loadRoot(mount)
            }
            return next
        })
    }

    const handleContextMenu = (e: React.MouseEvent, entry: WorkspaceEntry) => {
        setContextMenu({ x: e.clientX, y: e.clientY, entry })
    }

    const handleContextAction = (type: ContextMenuAction['type']) => {
        if (contextMenu && onContextAction) {
            onContextAction({ type, entry: contextMenu.entry })
        }
        setContextMenu(null)
    }

    const mountIcon = (mount: WorkspaceMount) => (
        mount.type === 'ssh'
            ? <Server className="w-3.5 h-3.5 text-indigo-400" />
            : <Folder className="w-3.5 h-3.5 text-emerald-400" />
    )

    const statusBadgeClass = (mount: WorkspaceMount) => {
        const status = statusLabel(mount)
        if (status === 'connected') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        if (status === 'connecting') return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        if (status === 'local') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
        return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30'
    }

    const hasMounts = mounts.length > 0

    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden relative",
            variant === 'panel' ? "bg-[#050508] border-r border-white/5 w-72" : "bg-transparent border-0 w-full"
        )}>
            <div className={cn(
                "p-3 flex items-center justify-between",
                variant === 'panel' ? "border-b border-white/5 bg-black/20" : "border-b border-white/5 bg-transparent"
            )}>
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Dosyalar</span>
                <button
                    onClick={onAddMount}
                    className="p-1.5 hover:bg-white/5 rounded-md transition-colors"
                    title="Bağlantı ekle"
                >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>

            {!hasMounts && (
                <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
                    Workspace yok.
                </div>
            )}

            <div className="flex-1 overflow-y-auto py-2 space-y-2 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                {mounts.map((mount) => (
                    <div key={mount.id} className="px-2">
                        <div
                            className={cn(
                                "flex items-center gap-2 px-2 py-2.5 rounded-lg cursor-pointer transition-all",
                                "hover:bg-white/5 text-muted-foreground hover:text-white"
                            )}
                            onClick={() => toggleMount(mount)}
                        >
                            {expandedMounts[mount.id] ? (
                                <ChevronDown className="w-4 h-4 opacity-70" />
                            ) : (
                                <ChevronRight className="w-4 h-4 opacity-70" />
                            )}
                            {mountIcon(mount)}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{mount.name}</div>
                            </div>
                            <span className={cn("text-xs font-semibold uppercase px-2 py-0.5 rounded-full border", statusBadgeClass(mount))}>
                                {statusLabel(mount)}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveMount(mount.id) }}
                                className="p-1 rounded-md hover:bg-white/5"
                                title="Kaldır"
                            >
                                <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                            </button>
                        </div>

                        {expandedMounts[mount.id] && (
                            <div className="mt-1.5">
                                <div className="flex items-center justify-between px-2 text-xs text-zinc-500 mb-1">
                                    <span className="truncate" title={mount.rootPath}>{mount.rootPath}</span>
                                    <button
                                        onClick={() => loadRoot(mount)}
                                        className="p-1 rounded-md hover:bg-white/5"
                                    >
                                        <RefreshCw className={cn("w-3 h-3", loadingMounts[mount.id] && "animate-spin")} />
                                    </button>
                                </div>
                                <div className="space-y-0.5">
                                    {(rootNodes[mount.id] || []).map((node) => (
                                        <WorkspaceTreeItem
                                            key={`${mount.id}:${node.path}`}
                                            node={node}
                                            mount={mount}
                                            level={0}
                                            refreshSignal={refreshSignal}
                                            onOpenFile={onOpenFile}
                                            onSelectEntry={onSelectEntry}
                                            selectedEntry={selectedEntry}
                                            onEnsureMount={onEnsureMount}
                                            onContextMenu={handleContextMenu}
                                        />
                                    ))}
                                    {(rootNodes[mount.id] || []).length === 0 && !loadingMounts[mount.id] && (
                                        <div className="text-xs text-zinc-600 pl-6 py-1 italic">Boş klasör</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-card border border-border/50 rounded-xl shadow-2xl py-1.5 min-w-[160px] animate-fade-in"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.entry.isDirectory && (
                        <>
                            <button
                                onClick={() => handleContextAction('createFile')}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                            >
                                <FilePlus className="w-4 h-4" />
                                Yeni Dosya
                            </button>
                            <button
                                onClick={() => handleContextAction('createFolder')}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Yeni Klasör
                            </button>
                            <div className="border-t border-border/30 my-1" />
                        </>
                    )}
                    <button
                        onClick={() => handleContextAction('rename')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                        Yeniden Adlandır
                    </button>
                    <button
                        onClick={() => handleContextAction('delete')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Sil
                    </button>
                </div>
            )}
        </div>
    )
}
