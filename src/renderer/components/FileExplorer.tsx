import React, { useState, useEffect } from 'react'
import { Folder, ChevronRight, ChevronDown, RefreshCw, FileText, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileNode {
    name: string
    isDirectory: boolean
    path: string
}

interface FileExplorerProps {
    rootPath: string
    onFileSelect: (path: string) => void
}

const FileTreeItem: React.FC<{
    node: FileNode
    level: number
    onSelect: (path: string) => void
}> = ({ node, level, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [children, setChildren] = useState<FileNode[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!node.isDirectory) {
            onSelect(node.path)
            return
        }

        const nextState = !isExpanded
        setIsExpanded(nextState)

        if (nextState && !hasLoaded) {
            setIsLoading(true)
            try {
                const result = await window.electron.listDirectory(node.path)
                if (result.success && result.files) {
                    // Sort: Directories first, then files
                    const sorted = result.files.sort((a: FileNode, b: FileNode) => {
                        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                        return a.isDirectory ? -1 : 1
                    })
                    setChildren(sorted)
                    setHasLoaded(true)
                }
            } catch (error) {
                console.error('Failed to load directory:', error)
            } finally {
                setIsLoading(false)
            }
        }
    }

    const getIcon = () => {
        if (node.isDirectory) return <Folder className={cn("w-4 h-4 text-blue-400", isExpanded && "fill-blue-400/20")} />
        if (node.name.endsWith('.tsx') || node.name.endsWith('.ts')) return <FileCode className="w-4 h-4 text-blue-300" />
        if (node.name.endsWith('.css') || node.name.endsWith('.scss')) return <FileCode className="w-4 h-4 text-pink-300" />
        if (node.name.endsWith('.json')) return <FileCode className="w-4 h-4 text-yellow-300" />
        return <FileText className="w-4 h-4 text-zinc-400" />
    }

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-all select-none group",
                    "hover:bg-muted/20 text-muted-foreground hover:text-foreground"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleToggle}
            >
                {node.isDirectory && (
                    <span className="opacity-70">
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-border/20 border-t-foreground/60 rounded-full animate-spin" />
                        ) : isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                        )}
                    </span>
                )}
                {!node.isDirectory && <span className="w-3.5" />} {/* Spacer */}

                {getIcon()}
                <span className="truncate text-xs font-medium">{node.name}</span>
            </div>

            {isExpanded && (
                <div className="flex flex-col">
                    {children.map((child) => (
                        <FileTreeItem key={child.path} node={child} level={level + 1} onSelect={onSelect} />
                    ))}
                    {children.length === 0 && hasLoaded && (
                        <div className="text-sm text-zinc-600 pl-8 py-1 italic">Boş klasör</div>
                    )}
                </div>
            )}
        </div>
    )
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ rootPath, onFileSelect }) => {
    const [rootFiles, setRootFiles] = useState<FileNode[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadRoot = async () => {
        if (!rootPath) return
        setIsLoading(true)
        try {
            const result = await window.electron.listDirectory(rootPath)
            if (result.success && result.files) {
                const sorted = result.files.sort((a: FileNode, b: FileNode) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                    return a.isDirectory ? -1 : 1
                })
                setRootFiles(sorted)
            }
        } catch (error) {
            console.error('Failed to load root:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadRoot()
    }, [rootPath])

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-64 overflow-hidden">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">DOSYALAR</span>
                <button
                    onClick={loadRoot}
                    className="p-1 hover:bg-muted/20 rounded-md transition-colors"
                >
                    <RefreshCw className={cn("w-3 h-3 text-muted-foreground", isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border/20 scrollbar-track-transparent">
                {rootFiles.map((file) => (
                    <FileTreeItem key={file.path} node={file} level={0} onSelect={onFileSelect} />
                ))}
            </div>
        </div>
    )
}
