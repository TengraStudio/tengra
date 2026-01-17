import { joinPath, sortNodes } from '@renderer/features/projects/utils/workspaceUtils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { FileIcon, FolderIcon } from '@/lib/file-icons'
import { cn } from '@/lib/utils'
import { WorkspaceEntry, WorkspaceMount } from '@/types'

export interface FileNode {
    name: string
    isDirectory: boolean
    path: string
}

type MountFileEntry = { name: string; isDirectory: boolean }

interface WorkspaceTreeItemProps {
    node: FileNode
    mount: WorkspaceMount
    level: number
    refreshSignal: number
    onOpenFile: (entry: WorkspaceEntry) => void
    onSelectEntry: (entry: WorkspaceEntry) => void
    selectedEntry?: WorkspaceEntry | null | undefined
    onEnsureMount?: ((mount: WorkspaceMount) => Promise<boolean> | boolean) | undefined
    onContextMenu?: ((e: React.MouseEvent, entry: WorkspaceEntry) => void) | undefined
    t: (key: string) => string
}

export const WorkspaceTreeItem: React.FC<WorkspaceTreeItemProps> = ({
    node, mount, level, refreshSignal, onOpenFile, onSelectEntry,
    selectedEntry, onEnsureMount, onContextMenu, t
}) => {
    const [expanded, setExpanded] = useState(false)
    const [children, setChildren] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const loadChildren = async () => {
        if (!node.isDirectory) { return }
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

            if (result?.success) {
                // Handle both response formats: { files } or { data }
                const fileList = (result as any).files || (result as any).data
                if (Array.isArray(fileList)) {
                    const mapped = fileList.map((item: MountFileEntry) => ({
                        name: item.name,
                        isDirectory: Boolean(item.isDirectory),
                        path: joinPath(node.path, item.name, mount.type)
                    }))
                    setChildren(sortNodes(mapped))
                    setLoaded(true)
                }
            }
        } catch (error) {
            console.error('Failed to load directory', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (expanded) { loadChildren() }
    }, [expanded, refreshSignal, loadChildren])

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
        selectedEntry?.mountId === mount.id && selectedEntry.path === node.path
    )

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-2 rounded-sm cursor-pointer transition-all select-none group border border-transparent",
                    isSelected ? "bg-primary/10 text-primary border-primary/20" : "hover:bg-white/5 text-muted-foreground/80 hover:text-white"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {node.isDirectory ? (
                    <span className="opacity-70 group-hover:opacity-100">
                        {loading ? (
                            <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                        ) : expanded ? (
                            <ChevronDown className="w-3 h-3" />
                        ) : (
                            <ChevronRight className="w-3 h-3" />
                        )}
                    </span>
                ) : (
                    <span className="w-3" />
                )}

                {node.isDirectory
                    ? <FolderIcon folderName={node.name} isOpen={expanded} className="w-3.5 h-3.5" />
                    : <FileIcon fileName={node.name} className="w-3.5 h-3.5" />}
                <span className="truncate text-[13px] font-normal tracking-tight">{node.name}</span>
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
                            t={t}
                        />
                    ))}
                    {children.length === 0 && loaded && (
                        <div className="text-[11px] text-muted-foreground/40 pl-8 py-0.5 italic">{t('workspace.emptyFolder')}</div>
                    )}
                </div>
            )}
        </div>
    )
}
