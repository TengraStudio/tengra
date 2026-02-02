import { appLogger } from '@main/logging/logger';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { renderIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';

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
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const toggleTimeoutRef = useRef<NodeJS.Timeout>();

    const handleToggle = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Debounce rapid folder clicks (300ms)
        if (toggleTimeoutRef.current) {
            clearTimeout(toggleTimeoutRef.current);
        }
        
        toggleTimeoutRef.current = setTimeout(async () => {
            if (node.isDirectory) {
                onFolderSelect?.(node.path);

                if (!isOpen && children.length === 0) {
                    setLoading(true);
                    try {
                        const response = await window.electron.files.listDirectory(node.path) as unknown as { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }> } | Array<{ name: string; isDirectory: boolean }>;
                        // Handle ServiceResponse format: { success, data } or direct array
                        const files = ('data' in response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : []);
                        const nodes: FileNode[] = files.map((f: { name: string; isDirectory: boolean }) => ({
                            name: f.name,
                            path: `${node.path}/${f.name}`.replace(/\/\//g, '/'),
                            isDirectory: f.isDirectory
                        })).sort((a: FileNode, b: FileNode) => {
                            if (a.isDirectory === b.isDirectory) { return a.name.localeCompare(b.name); }
                            return a.isDirectory ? -1 : 1;
                        });
                        setChildren(nodes);
                        setIsOpen(true);
                    } catch (error) {
                        appLogger.error('FileExplorer', 'Failed to load directory', error as Error);
                    } finally {
                        setLoading(false);
                    }
                } else {
                    setIsOpen(!isOpen);
                }
            }
        }, 300); // 300ms debounce
    }, [node.path, node.isDirectory, isOpen, children.length, onFolderSelect]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (toggleTimeoutRef.current) {
                clearTimeout(toggleTimeoutRef.current);
            }
        };
    }, []);

    // Use the new centralized file icons system
    const icon = renderIcon(node.name, node.isDirectory, isOpen, { size: 14 });

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-2 hover:bg-accent/50 cursor-pointer select-none transition-colors rounded-sm",
                    "text-sm text-muted-foreground hover:text-foreground"
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => { void (async () => { await handleToggle({ stopPropagation: () => {} } as React.MouseEvent); })(); }}
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
    );
};

export const FileExplorer = ({ rootPath, onFileSelect, onFolderSelect }: FileExplorerProps) => {
    const { t } = useTranslation();
    const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadRoot = async () => {
            if (!rootPath) { return; }
            setLoading(true);
            try {
                const response = await window.electron.files.listDirectory(rootPath) as unknown as { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }> } | Array<{ name: string; isDirectory: boolean }>;
                // Handle ServiceResponse format: { success, data } or direct array
                const files = ('data' in response && Array.isArray(response.data)) ? response.data : (Array.isArray(response) ? response : []);
                const nodes: FileNode[] = files.map((f: { name: string; isDirectory: boolean }) => ({
                    name: f.name,
                    path: `${rootPath}/${f.name}`.replace(/\/\//g, '/'),
                    isDirectory: f.isDirectory
                })).sort((a: FileNode, b: FileNode) => {
                    if (a.isDirectory === b.isDirectory) { return a.name.localeCompare(b.name); }
                    return a.isDirectory ? -1 : 1;
                });
                setRootNodes(nodes);
            } catch (error) {
                appLogger.error('FileExplorer', 'Failed to load root directory', error as Error);
            } finally {
                setLoading(false);
            }
        };
        void loadRoot();
    }, [rootPath]);

    if (loading) { return <div className="p-4 text-xs text-muted-foreground">{t('projectDashboard.loadingFiles')}</div>; }

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            {rootNodes.map(node => (
                <FileTreeItem key={node.path} node={node} onSelect={onFileSelect ?? (() => { })} onFolderSelect={onFolderSelect} />
            ))}
            {rootNodes.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">{t('projectDashboard.emptyDir')}</div>
            )}
        </div>
    );
};
