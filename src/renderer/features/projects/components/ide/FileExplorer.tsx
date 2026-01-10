import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import { ChevronRight, ChevronDown, File, Folder, FileText, Image, Code, FileJson, FileCode, Box, Hash, Terminal, Database, Book, Layers, Cpu, Component, Coffee } from 'lucide-react'
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
    onFolderSelect?: (path: string) => void
}

const FileTreeItem = ({ node, depth = 0, onSelect, onFolderSelect }: { node: FileNode, depth?: number, onSelect: (path: string) => void, onFolderSelect?: (path: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [children, setChildren] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (node.isDirectory) {
            onFolderSelect?.(node.path)

            if (!isOpen && children.length === 0) {
                setLoading(true)
                try {
                    const response = await window.electron.files.listDirectory(node.path) as unknown as { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }> } | Array<{ name: string; isDirectory: boolean }>
                    // Handle ServiceResponse format: { success, data } or direct array
                    const files = (response && 'data' in response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : [])
                    const nodes: FileNode[] = files.map((f: { name: string; isDirectory: boolean }) => ({
                        name: f.name,
                        path: `${node.path}/${f.name}`.replace(/\/\//g, '/'),
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
        if (node.isDirectory) return isOpen ? <Folder size={14} className="text-blue-400/80" /> : <Folder size={14} className="text-blue-400/80" />

        const name = node.name.toLowerCase()
        if (name.endsWith('.tsx') || name.endsWith('.jsx')) return <Code size={14} className="text-cyan-400" />
        if (name.endsWith('.ts')) return <FileCode size={14} className="text-blue-400" />
        if (name.endsWith('.js')) return <FileCode size={14} className="text-yellow-400" />
        if (name.endsWith('.py')) return <Box size={14} className="text-blue-500" />
        if (name.endsWith('.go')) return <Cpu size={14} className="text-cyan-500" />
        if (name.endsWith('.rs')) return <Layers size={14} className="text-orange-500" />
        if (name.endsWith('.java')) return <Coffee size={14} className="text-red-400" />
        if (name.endsWith('.php')) return <FileCode size={14} className="text-purple-400" />
        if (name.endsWith('.html')) return <Code size={14} className="text-orange-400" />
        if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.sass')) return <FileText size={14} className="text-pink-400" />
        if (name.endsWith('.json')) return <FileJson size={14} className="text-yellow-500/80" />
        if (name.endsWith('.md')) return <Book size={14} className="text-blue-300" />
        if (name.endsWith('.yaml') || name.endsWith('.yml')) return <Layers size={14} className="text-purple-300" />
        if (name.endsWith('.sql')) return <Database size={14} className="text-emerald-400" />
        if (name.endsWith('.sh') || name.endsWith('.bash') || name.endsWith('.zsh')) return <Terminal size={14} className="text-emerald-500" />
        if (name.endsWith('.png') || name.endsWith('.svg') || name.endsWith('.jpg') || name.endsWith('.jpeg')) return <Image size={14} className="text-purple-400" />
        if (name.includes('package.json') || name.includes('cargo.toml') || name.includes('go.mod')) return <Hash size={14} className="text-red-400" />
        if (name.endsWith('.vue') || name.endsWith('.svelte')) return <Component size={14} className="text-emerald-400" />

        return <File size={14} className="text-muted-foreground/60" />
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
                            <FileTreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} onFolderSelect={onFolderSelect} />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export const FileExplorer = ({ rootPath, onFileSelect, onFolderSelect }: FileExplorerProps) => {
    const { t } = useTranslation()
    const [rootNodes, setRootNodes] = useState<FileNode[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const loadRoot = async () => {
            if (!rootPath) return
            setLoading(true)
            try {
                const response = await window.electron.files.listDirectory(rootPath) as unknown as { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }> } | Array<{ name: string; isDirectory: boolean }>
                // Handle ServiceResponse format: { success, data } or direct array
                const files = (response && 'data' in response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : [])
                const nodes: FileNode[] = files.map((f: { name: string; isDirectory: boolean }) => ({
                    name: f.name,
                    path: `${rootPath}/${f.name}`.replace(/\/\//g, '/'),
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

    if (loading) return <div className="p-4 text-xs text-muted-foreground">{t('projectDashboard.loadingFiles')}</div>

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {rootNodes.map(node => (
                <FileTreeItem key={node.path} node={node} onSelect={onFileSelect || (() => { })} onFolderSelect={onFolderSelect} />
            ))}
            {rootNodes.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">{t('projectDashboard.emptyDir')}</div>
            )}
        </div>
    )
}
