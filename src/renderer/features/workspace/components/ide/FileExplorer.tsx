/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { renderIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
}

// PERF-005-2: Directory listing cache with LRU eviction
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 30000; // 30 seconds

interface CacheEntry {
    data: FileNode[];
    timestamp: number;
}

class DirectoryCache {
    private cache = new Map<string, CacheEntry>();

    get(path: string): FileNode[] | null {
        const entry = this.cache.get(path);
        if (!entry) {
            return null;
        }

        // Check if cache entry has expired
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            this.cache.delete(path);
            return null;
        }

        return entry.data;
    }

    set(path: string, data: FileNode[]): void {
        // LRU eviction: remove oldest entry if cache is full
        if (this.cache.size >= CACHE_MAX_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(path, { data, timestamp: Date.now() });
    }

    invalidate(path: string): void {
        this.cache.delete(path);
    }

    clear(): void {
        this.cache.clear();
    }
}

// Singleton cache instance shared across all FileExplorer components
const directoryCache = new DirectoryCache();

interface FileExplorerProps {
    rootPath?: string;
    onFileSelect?: (path: string) => void;
    onFolderSelect?: (path: string) => void;
}

const FileTreeItem = ({
    node,
    depth = 0,
    onSelect,
    onFolderSelect,
}: {
    node: FileNode;
    depth?: number;
    onSelect: (path: string) => void;
    onFolderSelect?: (path: string) => void;
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const toggleTimeoutRef = useRef<NodeJS.Timeout>();
    // CLEAN-002-1: Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);

    const handleToggle = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();

            // Debounce rapid folder clicks (300ms)
            if (toggleTimeoutRef.current) {
                clearTimeout(toggleTimeoutRef.current);
            }

            toggleTimeoutRef.current = setTimeout(() => {
                void (async () => {
                    // CLEAN-002-1: Check if still mounted before proceeding
                    if (!isMountedRef.current) {
                        return;
                    }

                    if (node.isDirectory) {
                        onFolderSelect?.(node.path);

                        if (!isOpen && children.length === 0) {
                            // PERF-005-2: Check cache first before fetching from filesystem
                            const cachedNodes = directoryCache.get(node.path);
                            if (cachedNodes) {
                                setChildren(cachedNodes);
                                setIsOpen(true);
                                return;
                            }

                            setLoading(true);
                            try {
                                const response = (await window.electron.files.listDirectory(
                                    node.path
                                )) as TypeAssertionValue as
                                    | {
                                          success?: boolean;
                                          data?: Array<{ name: string; isDirectory: boolean }>;
                                      }
                                    | Array<{ name: string; isDirectory: boolean }>;

                                // CLEAN-002-1: Check if still mounted after async operation
                                if (!isMountedRef.current) {
                                    return;
                                }

                                // Handle ServiceResponse format: { success, data } or direct array
                                const files =
                                    'data' in response && Array.isArray(response.data)
                                        ? response.data
                                        : Array.isArray(response)
                                          ? response
                                          : [];
                                const nodes: FileNode[] = files
                                    .map((f: { name: string; isDirectory: boolean }) => ({
                                        name: f.name,
                                        path: `${node.path}/${f.name}`.replace(/\/\//g, '/'),
                                        isDirectory: f.isDirectory,
                                    }))
                                    .sort((a: FileNode, b: FileNode) => {
                                        if (a.isDirectory === b.isDirectory) {
                                            return a.name.localeCompare(b.name);
                                        }
                                        return a.isDirectory ? -1 : 1;
                                    });

                                // PERF-005-2: Cache the directory listing
                                directoryCache.set(node.path, nodes);

                                setChildren(nodes);
                                setIsOpen(true);
                            } catch (error) {
                                // CLEAN-002-1: Only log error if still mounted
                                if (isMountedRef.current) {
                                    appLogger.error(
                                        'FileExplorer',
                                        'Failed to load directory',
                                        error as Error
                                    );
                                }
                            } finally {
                                // CLEAN-002-1: Only update loading state if still mounted
                                if (isMountedRef.current) {
                                    setLoading(false);
                                }
                            }
                        } else {
                            setIsOpen(!isOpen);
                        }
                    }
                })();
            }, 300); // 300ms debounce
        },
        [node.path, node.isDirectory, isOpen, children.length, onFolderSelect]
    );

    // CLEAN-002-1: Cleanup timeout and track unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
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
                    'flex items-center gap-1.5 py-1 px-2 hover:bg-accent/50 cursor-pointer select-none transition-colors rounded-sm',
                    'text-sm text-muted-foreground hover:text-foreground'
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => {
                    void (async () => {
                        await handleToggle({ stopPropagation: () => {} } as React.MouseEvent);
                    })();
                }}
            >
                <span className="opacity-70 w-4 flex justify-center">
                    {node.isDirectory &&
                        (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                </span>
                {icon}
                <span className="truncate">{node.name}</span>
            </div>
            {isOpen && (
                <div>
                    {loading ? (
                        <div className="pl-8 py-1 typo-caption text-muted-foreground">
                            {t('common.loading')}
                        </div>
                    ) : (
                        children.map(child => (
                            <FileTreeItem
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                onSelect={onSelect}
                                onFolderSelect={onFolderSelect}
                            />
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
    // CLEAN-002-1: Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const loadRoot = async () => {
            if (!rootPath) {
                return;
            }

            // PERF-005-2: Check cache first before fetching from filesystem
            const cachedNodes = directoryCache.get(rootPath);
            if (cachedNodes) {
                setRootNodes(cachedNodes);
                return;
            }

            setLoading(true);
            try {
                const response = (await window.electron.files.listDirectory(
                    rootPath
                )) as TypeAssertionValue as
                    | { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }> }
                    | Array<{ name: string; isDirectory: boolean }>;

                // CLEAN-002-1: Check if still mounted after async operation
                if (!isMountedRef.current) {
                    return;
                }

                // Handle ServiceResponse format: { success, data } or direct array
                const files =
                    'data' in response && Array.isArray(response.data)
                        ? response.data
                        : Array.isArray(response)
                          ? response
                          : [];
                const nodes: FileNode[] = files
                    .map((f: { name: string; isDirectory: boolean }) => ({
                        name: f.name,
                        path: `${rootPath}/${f.name}`.replace(/\/\//g, '/'),
                        isDirectory: f.isDirectory,
                    }))
                    .sort((a: FileNode, b: FileNode) => {
                        if (a.isDirectory === b.isDirectory) {
                            return a.name.localeCompare(b.name);
                        }
                        return a.isDirectory ? -1 : 1;
                    });

                // PERF-005-2: Cache the directory listing
                directoryCache.set(rootPath, nodes);

                setRootNodes(nodes);
            } catch (error) {
                // CLEAN-002-1: Only log error if still mounted
                if (isMountedRef.current) {
                    appLogger.error(
                        'FileExplorer',
                        'Failed to load root directory',
                        error as Error
                    );
                }
            } finally {
                // CLEAN-002-1: Only update loading state if still mounted
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        };
        void loadRoot();

        // CLEAN-002-1: Cleanup on unmount
        return () => {
            isMountedRef.current = false;
        };
    }, [rootPath]);

    if (loading) {
        return (
            <div className="p-4 typo-caption text-muted-foreground">
                {t('workspaceDashboard.loadingFiles')}
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            {rootNodes.map(node => (
                <FileTreeItem
                    key={node.path}
                    node={node}
                    onSelect={onFileSelect ?? (() => {})}
                    onFolderSelect={onFolderSelect}
                />
            ))}
            {rootNodes.length === 0 && (
                <div className="p-4 typo-caption text-muted-foreground text-center">
                    {t('workspaceDashboard.emptyDir')}
                </div>
            )}
        </div>
    );
};
