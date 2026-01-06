import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FileText, Image, Code } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileNode {
    name: string
    path: string
    isDirectory: boolean
    children?: FileNode[]
}

interface FileExplorerProps {
    rootPath?: string
    onFileSelect?: (path: string) => void
}

const FileTreeItem = ({ node, depth = 0, onSelect }: { node: FileNode, depth?: number, onSelect: (path: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [children, setChildren] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (node.isDirectory) {
            if (!isOpen && children.length === 0) {
                setLoading(true)
                try {
                    const files = await window.electron.files.listDirectory(node.path)
                    // Transform to FileNode
                    const nodes: FileNode[] = files.map((f: any) => ({
                        name: f.name,
                        path: f.path,
                        isDirectory: f.isDirectory
                    })).sort((a: FileNode, b: FileNode) => {
                        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                        return a.isDirectory ? -1 : 1
                    })
                    setChildren(nodes)
                    setIsOpen(true)
                } catch (error) {
                    console.error('Failed to load directory:', error)
                } finally {
                    setLoading(false)
                }
            } else {
                setIsOpen(!isOpen)
            }
        } else {
            onSelect(node.path)
        }
    }

    const getIcon = () => {
        if (node.isDirectory) return isOpen ? <Folder size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />
        if (node.name.endsWith('.tsx') || node.name.endsWith('.ts')) return <Code size={14} className="text-blue-300" />
        if (node.name.endsWith('.css') || node.name.endsWith('.scss')) return <FileText size={14} className="text-pink-300" />
        if (node.name.endsWith('.png') || node.name.endsWith('.svg')) return <Image size={14} className="text-purple-300" />
        return <File size={14} className="text-muted-foreground" />
    }

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer select-none transition-colors rounded-sm",
                    "text-sm text-gray-300 hover:text-white"
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleToggle}
            >
                <span className="opacity-70 w-4 flex justify-center">
                    {node.isDirectory && (
                        isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </span>
                {getIcon()}
                <span className="truncate">{node.name}</span>
            </div>
            {isOpen && (
                <div>
                    {loading ? (
                        <div className="pl-8 py-1 text-xs text-muted-foreground">Loading...</div>
                    ) : (
                        children.map(child => (
                            <FileTreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export const FileExplorer = ({ rootPath, onFileSelect }: FileExplorerProps) => {
    const [rootNodes, setRootNodes] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const loadRoot = async () => {
            if (!rootPath) return
            setLoading(true)
            try {
                const files = await window.electron.files.listDirectory(rootPath)
                const nodes: FileNode[] = files.map((f: any) => ({
                    name: f.name,
                    path: f.path,
                    isDirectory: f.isDirectory
                })).sort((a: FileNode, b: FileNode) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
                    return a.isDirectory ? -1 : 1
                })
                setRootNodes(nodes)
            } catch (error) {
                console.error("Failed to load root:", error)
            } finally {
                setLoading(false)
            }
        }
        loadRoot()
    }, [rootPath])

    if (loading) return <div className="p-4 text-xs text-muted-foreground">Loading file tree...</div>

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {rootNodes.map(node => (
                <FileTreeItem key={node.path} node={node} onSelect={onFileSelect || (() => { })} />
            ))}
            {rootNodes.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">Empty directory</div>
            )}
        </div>
    )
}
