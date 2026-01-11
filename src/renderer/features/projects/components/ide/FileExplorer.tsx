import { useState, useEffect } from 'react'
import { useTranslation } from '@/i18n'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderIcon } from '@/lib/file-icons'

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

    // Use the new centralized file icons system
    const icon = renderIcon(node.name, node.isDirectory, isOpen, { size: 14 })

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
                {icon}
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
