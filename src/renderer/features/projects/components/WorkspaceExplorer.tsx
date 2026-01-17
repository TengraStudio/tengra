import { FileNode, WorkspaceTreeItem } from '@renderer/features/projects/components/WorkspaceTreeItem'
import { joinPath, sortNodes } from '@renderer/features/projects/utils/workspaceUtils'
import { ChevronDown, ChevronRight, FilePlus, Folder, FolderPlus, Pencil, Plus, Server, Trash2, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { WorkspaceEntry, WorkspaceMount } from '@/types'

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
    language: Language
}

interface ContextMenuState {
    x: number
    y: number
    entry?: WorkspaceEntry
    mountId?: string // For mount-level context menu
}

type MountFileEntry = { name: string; isDirectory: boolean }

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
    variant = 'panel',
    language
}) => {
    const { t } = useTranslation(language || 'en')
    const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>({})
    const [rootNodes, setRootNodes] = useState<Record<string, FileNode[]>>({})
    const [loadingMounts, setLoadingMounts] = useState<Record<string, boolean>>({})
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

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
            if (result?.success) {
                // Handle both response formats: { files } or { data }
                const anyResult = result as { files?: MountFileEntry[]; data?: MountFileEntry[] }
                const fileList = anyResult.files || anyResult.data || []
                if (Array.isArray(fileList)) {
                    const mapped = fileList.map((item: MountFileEntry) => ({
                        name: item.name,
                        isDirectory: Boolean(item.isDirectory),
                        path: joinPath(mount.rootPath, item.name, mount.type)
                    }))
                    setRootNodes((prev) => ({ ...prev, [mount.id]: sortNodes(mapped) }))
                }
            }
        } catch (error) {
            console.error('Failed to load mount root', error)
        } finally {
            setLoadingMounts((prev) => ({ ...prev, [mount.id]: false }))
        }
    }

    useEffect(() => {
        mounts.forEach((mount) => {
            // Auto-load if explicit expanded OR if it's the only local mount (which hides the toggle)
            const shouldLoad = expandedMounts[mount.id] || (mounts.length === 1 && mount.type === 'local')

            if (shouldLoad) {
                // Avoid reloading if already loaded and no refresh signal? 
                // Actually loadRoot handles re-fetching.
                // We want to fetch on mount.
                loadRoot(mount)
            }
        })
    }, [refreshSignal, mounts])

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        if (contextMenu) {
            document.addEventListener('click', handleClick)
            return () => document.removeEventListener('click', handleClick)
        }
        return undefined
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
        if (contextMenu?.entry && onContextAction) {
            onContextAction({ type, entry: contextMenu.entry })
        }
        setContextMenu(null)
    }

    const mountIcon = (mount: WorkspaceMount) => (
        mount.type === 'ssh'
            ? <Server className="w-3.5 h-3.5 text-indigo-400" />
            : <Folder className="w-3.5 h-3.5 text-emerald-400" />
    )


    const hasMounts = mounts.length > 0

    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden relative transition-all duration-300",
            variant === 'panel' ? "bg-background/40 backdrop-blur-xl border-r border-white/5 w-72" : "bg-transparent border-0 w-full"
        )}>
            <div className={cn(
                "p-4 pb-2 flex items-center justify-between",
                variant === 'panel' ? "border-b border-white/5 bg-transparent" : "border-b border-white/5 bg-transparent"
            )}>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">{t('workspace.files')}</span>
                <button
                    onClick={onAddMount}
                    className="p-1.5 hover:bg-white/5 rounded-md transition-colors group"
                    title={t('workspace.addConnection')}
                >
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                </button>
            </div>

            {!hasMounts && (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-zinc-500 gap-2 opacity-60">
                    <Folder className="w-8 h-8 opacity-20" />
                    <span className="text-xs font-medium">{t('workspace.noMounts')}</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent px-0">
                {mounts.map((mount) => (
                    <div key={mount.id} className="group/mount">
                        {/* Only show mount header if there are multiple mounts or it's an SSH mount */}
                        {(mounts.length > 1 || mount.type !== 'local') && (
                            <div
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-all duration-200 border-l-2 border-transparent",
                                    "hover:bg-white/5 text-muted-foreground hover:text-white group-hover/mount:bg-white/[0.02]",
                                    expandedMounts[mount.id] ? "text-foreground" : ""
                                )}
                                onClick={() => toggleMount(mount)}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setContextMenu({ x: e.clientX, y: e.clientY, mountId: mount.id })
                                }}
                            >
                                <span className="opacity-50 group-hover/mount:opacity-100 transition-opacity">
                                    {expandedMounts[mount.id] ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                </span>
                                {mountIcon(mount)}
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <div className="text-xs font-bold uppercase tracking-wider truncate text-muted-foreground/70">{mount.name}</div>
                                    {mount.type === 'ssh' && (
                                        <span className="px-1 py-0.5 rounded-[3px] bg-indigo-500/20 text-indigo-300 text-[9px] font-bold border border-indigo-500/30">SSH</span>
                                    )}
                                    {mount.type !== 'local' && (
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            mountStatus[mount.id] === 'connected' ? "bg-emerald-500" :
                                                mountStatus[mount.id] === 'connecting' ? "bg-amber-500 animate-pulse" :
                                                    "bg-red-500/50"
                                        )} title={mountStatus[mount.id]} />
                                    )}
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveMount(mount.id) }}
                                    className="p-1 rounded opacity-0 group-hover/mount:opacity-100 hover:text-red-400 transition-all"
                                    title={t('workspace.removeMount')}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <div className={cn(
                            (mounts.length > 1 || mount.type !== 'local') && !expandedMounts[mount.id] ? "hidden" : "block",
                            (mounts.length > 1 || mount.type !== 'local') ? "ml-0" : "" // Indent if nested
                        )}>
                            <div className="space-y-0 relative">
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
                                        t={t}
                                    />
                                ))}
                                {(rootNodes[mount.id] || []).length === 0 && !loadingMounts[mount.id] && (
                                    <div className="text-[11px] text-muted-foreground/40 pl-4 py-2 italic flex items-center gap-2">
                                        {t('workspace.emptyFolder')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Context Menu - rendered via portal for proper z-stacking */}
            {contextMenu && createPortal(
                <div
                    className="fixed bg-[#0A0A0A]/95 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 99999
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Mount-level context menu */}
                    {contextMenu.mountId && !contextMenu.entry && (
                        <button
                            onClick={() => {
                                if (contextMenu.mountId) {
                                    onRemoveMount(contextMenu.mountId)
                                }
                                setContextMenu(null)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('workspace.removeMount')}
                        </button>
                    )}

                    {/* File/Folder context menu */}
                    {contextMenu.entry && (
                        <>
                            {contextMenu.entry.isDirectory && (
                                <>
                                    <button
                                        onClick={() => handleContextAction('createFile')}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                    >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        {t('workspace.newFile')}
                                    </button>
                                    <button
                                        onClick={() => handleContextAction('createFolder')}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                    >
                                        <FolderPlus className="w-3.5 h-3.5" />
                                        {t('workspace.newFolder')}
                                    </button>
                                    <div className="h-px bg-white/5 my-1 mx-2" />
                                </>
                            )}
                            <button
                                onClick={() => handleContextAction('rename')}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                {t('workspace.rename')}
                            </button>
                            <button
                                onClick={() => handleContextAction('delete')}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('common.delete')}
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

        </div>
    )
}
