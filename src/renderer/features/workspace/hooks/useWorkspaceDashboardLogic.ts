/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { FileSearchResult } from '@shared/types/common';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useVisibilityAwareInterval } from '@/hooks/useAppVisibility';
import { Language, useTranslation } from '@/i18n';
import type { Workspace, WorkspaceAnalysis, WorkspaceDashboardTab, WorkspaceStats } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

const WORKSPACE_ANALYSIS_REFRESH_INTERVAL_MS = 90_000;
const SUMMARY_REQUEST_CACHE_TTL_MS = 5_000;

interface SummaryRequestCacheEntry {
    startedAt: number;
    request: Promise<WorkspaceAnalysis>;
}

const summaryRequestCache = new Map<string, SummaryRequestCacheEntry>();

function getSummaryRequest(cacheKey: string, workspacePath: string, workspaceId: string): Promise<WorkspaceAnalysis> {
    const cachedRequest = summaryRequestCache.get(cacheKey);
    if (cachedRequest && Date.now() - cachedRequest.startedAt < SUMMARY_REQUEST_CACHE_TTL_MS) {
        return cachedRequest.request;
    }

    const request = window.electron.workspace.analyzeSummary(workspacePath, workspaceId);
    summaryRequestCache.set(cacheKey, {
        startedAt: Date.now(),
        request,
    });
    return request;
}

interface UseWorkspaceDashboardLogicProps {
    workspace: Workspace;
    activeTab?: WorkspaceDashboardTab;
    onTabChange?: (tab: WorkspaceDashboardTab) => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string, line?: number) => void;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    language?: Language;
}

export interface OpenFile {
    path: string;
    name: string;
    content: string;
    isDirty: boolean;
    initialLine?: number;
    gitStatus?: string;
    gitRawStatus?: string;
    originalContent?: string;
    diff?: {
        oldValue: string;
        newValue: string;
    };
}

function normalizeSearchResults(value: FileSearchResult[] | null | undefined): FileSearchResult[] {
    return Array.isArray(value) ? value : [];
}

function normalizeWorkspaceAnalysis(value: WorkspaceAnalysis): WorkspaceAnalysis {
    return {
        ...value,
        frameworks: Array.isArray(value.frameworks) ? value.frameworks : [],
        dependencies:
            value.dependencies && typeof value.dependencies === 'object' ? value.dependencies : {},
        devDependencies:
            value.devDependencies && typeof value.devDependencies === 'object'
                ? value.devDependencies
                : {},
        languages:
            value.languages && typeof value.languages === 'object' ? value.languages : {},
        files: Array.isArray(value.files) ? value.files : [],
        todos: Array.isArray(value.todos) ? value.todos : [],
        issues: Array.isArray(value.issues) ? value.issues : [], 
    };
}

export function useWorkspaceDashboardLogic({ workspace, activeTab: externalTab, onTabChange, selectedEntry, onOpenFile, onUpdate, language = 'en' }: UseWorkspaceDashboardLogicProps) {
    const { t } = useTranslation(language);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [analysis, setAnalysis] = useState<WorkspaceAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [internalTab, setInternalTab] = useState<WorkspaceDashboardTab>('overview');
    const activeTab = externalTab ?? internalTab;
    const setActiveTab = (onTabChange ?? setInternalTab) as (tab: WorkspaceDashboardTab) => void;
    const [workspaceRoot, setWorkspaceRoot] = useState<string>(workspace.path);
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editName, setEditName] = useState(workspace.title);
    const [editDesc, setEditDesc] = useState(workspace.description || '');
    const searchPersistenceKey = `search_v2:${workspace.id}`;
    const getSaved = () => {
        try {
            const saved = localStorage.getItem(searchPersistenceKey);
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    };
    const savedState = getSaved();

    const [searchQuery, setSearchQuery] = useState(savedState.searchQuery || '');
    const [replaceQuery, setReplaceQuery] = useState(savedState.replaceQuery || '');
    const [isRegex, setIsRegex] = useState(savedState.isRegex ?? false);
    const [matchCase, setMatchCase] = useState(savedState.matchCase ?? false);
    const [matchWholeWord, setMatchWholeWord] = useState(savedState.matchWholeWord ?? false);
    const [includeGlob, setIncludeGlob] = useState(savedState.includeGlob || '');
    const [excludeGlob, setExcludeGlob] = useState(savedState.excludeGlob || '');
    const [replaceExpanded, setReplaceExpanded] = useState(savedState.replaceExpanded ?? false);
    const [filtersExpanded, setFiltersExpanded] = useState(savedState.filtersExpanded ?? false);
    const [searchResults, setSearchResults] = useState<FileSearchResult[]>(savedState.searchResults || []);
    const [isSearching, setIsSearching] = useState(false);
    const analysisRef = useRef<WorkspaceAnalysis | null>(null);
    const activeSearchRequestIdRef = useRef<string | null>(null);

    const summaryCacheKey = `${workspace.id}:${workspace.path}`;


    // Save search state to localStorage
    useEffect(() => {
        const stateToSave = {
            searchQuery, replaceQuery, isRegex, matchCase, matchWholeWord,
            includeGlob, excludeGlob, replaceExpanded, filtersExpanded, searchResults
        };
        localStorage.setItem(searchPersistenceKey, JSON.stringify(stateToSave));
    }, [searchQuery, replaceQuery, isRegex, matchCase, matchWholeWord, includeGlob, excludeGlob, replaceExpanded, filtersExpanded, searchResults, workspace.id]);

    // Reset state when workspace changes
    const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspace.id);
    if (workspace.id !== prevWorkspaceId) {
        setPrevWorkspaceId(workspace.id);
        setWorkspaceRoot(workspace.path);
        setEditName(workspace.title);
        setEditDesc(workspace.description || '');
        setAnalysis(null);
        setStats(null);
        queueMicrotask(() => {
            setLoading(false);
        });
    }

    useEffect(() => {
        analysisRef.current = null;
    }, [workspace.id]);

    useEffect(() => {
        analysisRef.current = analysis;
    }, [analysis]);

    // Adjust selected folder when selected entry changes
    const [prevSelectedEntryPath, setPrevSelectedEntryPath] = useState(selectedEntry?.path);
    if (selectedEntry?.path !== prevSelectedEntryPath) {
        setPrevSelectedEntryPath(selectedEntry?.path);
        setSelectedFolder(selectedEntry?.isDirectory ? selectedEntry.path : null);
    }

    const handleSearch = useCallback(async (options?: { isRegex?: boolean, matchCase?: boolean, matchWholeWord?: boolean }) => {
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) { 
            setSearchResults([]);
            return; 
        }

        // Cancel previous search
        if (activeSearchRequestIdRef.current) {
            void window.electron.code.searchFilesCancel(activeSearchRequestIdRef.current);
        }

        const requestId = Math.random().toString(36).substring(2, 15);
        activeSearchRequestIdRef.current = requestId;

        setIsSearching(true);
        setSearchResults([]); // Clear results for new search

        try {
            await window.electron.code.searchFilesStream(
                workspaceRoot, 
                searchQuery, 
                requestId,
                {
                    isRegex: options?.isRegex ?? isRegex,
                    matchCase: options?.matchCase ?? matchCase,
                    matchWholeWord: options?.matchWholeWord ?? matchWholeWord,
                    includeGlob: includeGlob,
                    excludeGlob: excludeGlob
                }
            );
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Search failed', error as Error);
            setIsSearching(false);
        }
    }, [searchQuery, workspaceRoot, isRegex, matchCase, matchWholeWord, includeGlob, excludeGlob]);

    useEffect(() => {
        const handleResultsChunk = (_event: unknown, data: { requestId: string; results: FileSearchResult[] }) => {
            if (data.requestId !== activeSearchRequestIdRef.current) {return;}
            
            setSearchResults(prev => {
                // Avoid duplicates if chunks somehow overlap (though they shouldn't)
                const existingPaths = new Set(prev.map(p => `${p.file}:${p.line}:${p.column}`));
                const newResults = data.results.filter(r => !existingPaths.has(`${r.file}:${r.line}:${r.column}`));
                return [...prev, ...newResults];
            });
        };

        const handleSearchComplete = (_event: unknown, data: { requestId: string }) => {
            if (data.requestId !== activeSearchRequestIdRef.current) {return;}
            setIsSearching(false);
        };

        const removeResultsListener = window.electron.ipcRenderer.on('code:search-results-chunk', handleResultsChunk);
        const removeCompleteListener = window.electron.ipcRenderer.on('code:search-complete', handleSearchComplete);

        return () => {
            removeResultsListener();
            removeCompleteListener();
        };
    }, []);

    const handleReplaceAll = useCallback(async (options?: { isRegex?: boolean, matchCase?: boolean, matchWholeWord?: boolean }) => {
        if (!searchQuery || !replaceQuery) {return;}
        
        const confirmResult = await window.electron.dialog.showMessageBox({
            type: 'warning',
            title: t('common.confirm'),
            message: t('frontend.workspaceDashboard.replaceAllConfirm', { 
                count: searchResults.length,
                query: searchQuery,
                replace: replaceQuery
            }),
            buttons: [t('common.cancel'), t('frontend.workspaceDashboard.replaceAll')]
        });

        if (confirmResult.response !== 1) {return;}

        setIsSearching(true);
        try {
            const fileGroups = new Map<string, number[]>();
            searchResults.forEach(r => {
                const lines = fileGroups.get(r.file) || [];
                lines.push(r.line);
                fileGroups.set(r.file, lines);
            });

            const flags = options?.matchCase ? 'g' : 'gi';
            let pattern = searchQuery;
            if (!options?.isRegex) {
                pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
            if (options?.matchWholeWord && !options?.isRegex) {
                pattern = `\\b${pattern}\\b`;
            }
            const regex = new RegExp(pattern, flags);

            for (const [filePath, _lines] of fileGroups) {
                const readRes = await window.electron.files.readFile(filePath);
                if (readRes.success && readRes.content) {
                    const newContent = readRes.content.replace(regex, replaceQuery);
                    await window.electron.files.writeFile(filePath, newContent, {
                        aiSystem: 'SearchReplace',
                        changeReason: `Replaced "${searchQuery}" with "${replaceQuery}"`
                    });
                }
            }
            
            await handleSearch(options);
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Replace all failed', error as Error);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery, replaceQuery, searchResults, t, handleSearch]);

    const loadWorkspaceSummary = useCallback(async () => {
        const shouldShowLoading = analysisRef.current === null;
        if (shouldShowLoading) {
            setLoading(true);
        }
        try {
            if (workspace.path) {
                const data = normalizeWorkspaceAnalysis(
                    await getSummaryRequest(summaryCacheKey, workspace.path, workspace.id)
                );
                setAnalysis(data);
                setStats(data.stats);
            }
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Workspace summary failed', error as Error);
        } finally {
            if (shouldShowLoading) {
                setLoading(false);
            }
        }
    }, [summaryCacheKey, workspace.path, workspace.id]);

    const analyzeWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            if (workspace.path) {
                const data = normalizeWorkspaceAnalysis(
                    await window.electron.workspace.analyze(workspace.path, workspace.id)
                );
                setAnalysis(data);
                setStats(data.stats);
            }
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Workspace analysis failed', error as Error);
        } finally {
            setLoading(false);
        }
    }, [workspace.path, workspace.id]);

    const handleSaveName = async () => {
        if (editName.trim() && editName !== workspace.title) { await onUpdate?.({ title: editName }); }
        setIsEditingName(false);
    };

    const handleSaveDesc = async () => {
        if (editDesc !== workspace.description) { await onUpdate?.({ description: editDesc }); }
        setIsEditingDesc(false);
    };

    useEffect(() => {
        if (activeTab !== 'overview' || analysis) {
            return;
        }
        queueMicrotask(() => {
            void loadWorkspaceSummary();
        });
    }, [activeTab, analysis, loadWorkspaceSummary]);

    useVisibilityAwareInterval(() => {
        if (activeTab === 'overview') {
            void loadWorkspaceSummary();
        }
    }, WORKSPACE_ANALYSIS_REFRESH_INTERVAL_MS);

    const handleFileSelect = useCallback(async (path: string, line?: number) => {
        if (onOpenFile) { return onOpenFile(path, line); }
        if (openFiles.find(f => f.path === path)) {
            setActiveFile(path);
            if (line !== undefined) { setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, initialLine: line, diff: undefined } : f)); }
            setActiveTab('files');
            return;
        }
        try {
            const content = await window.electron.files.readFile(path);
            const name = path.split(/[\\/]/).pop() ?? 'file';
            setOpenFiles(prev => [...prev, { path, name, content, isDirty: false, initialLine: line }]);
            setActiveFile(path);
            setActiveTab('files');
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Failed to open file', error as Error);
        }
    }, [onOpenFile, openFiles, setActiveTab]);

    const handleDiffSelect = useCallback(async (path: string, diffId?: string) => {
        try {
            const diff = diffId ? await window.electron.workspace.getFileDiff(diffId) : null;
            if (!diff) {
                // If no diffId or diff not found, just open the file normally
                return handleFileSelect(path);
            }

            const name = `Diff: ${path.split(/[\\/]/).pop() ?? 'file'}`;
            const virtualPath = `diff:${diffId}:${path}`;

            if (openFiles.find(f => f.path === virtualPath)) {
                setActiveFile(virtualPath);
                setActiveTab('files');
                return;
            }

            setOpenFiles(prev => [...prev, {
                path: virtualPath,
                name,
                content: diff.newValue,
                isDirty: false,
                diff: {
                    oldValue: diff.oldValue,
                    newValue: diff.newValue
                }
            }]);
            setActiveFile(virtualPath);
            setActiveTab('files');
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Failed to open diff', error as Error);
            // Fallback to normal file select
            void handleFileSelect(path);
        }
    }, [handleFileSelect, openFiles, setActiveTab]);

    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent;
            const action = customEvent.detail;
            if (!action || typeof action !== 'object') { return; }

            if (action.type === 'open_file') {
                void handleFileSelect(action.path, action.line);
            } else if (action.type === 'open_diff') {
                void handleDiffSelect(action.path, action.diffId);
            }
        };

        window.addEventListener('tengra:workspace-navigate', handler);
        return () => window.removeEventListener('tengra:workspace-navigate', handler);
    }, [openFiles, handleFileSelect, handleDiffSelect]);

    const closeFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const newFiles = openFiles.filter(f => f.path !== path);
        setOpenFiles(newFiles);
        if (activeFile === path) { setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null); }
    };

    const activeFileObj = openFiles.find(f => f.path === activeFile);

    return {
        t,
        state: { 
            stats, analysis, loading, activeTab, workspaceRoot, openFiles, activeFile, selectedFolder, 
            searchQuery, replaceQuery, isRegex, matchCase, matchWholeWord, includeGlob, excludeGlob, 
            replaceExpanded, filtersExpanded, searchResults, isSearching, activeFileObj 
        },
        actions: { 
            setActiveTab, setOpenFiles, setActiveFile, setSearchQuery, setReplaceQuery, 
            setIsRegex, setMatchCase, setMatchWholeWord, setIncludeGlob, setExcludeGlob,
            setReplaceExpanded, setFiltersExpanded,
            handleSearch, handleReplaceAll, analyzeWorkspace, loadWorkspaceSummary, handleFileSelect, closeFile 
        },
        editing: { isEditingName, setIsEditingName, editName, setEditName, handleSaveName, isEditingDesc, setIsEditingDesc, editDesc, setEditDesc, handleSaveDesc }
    };
}

