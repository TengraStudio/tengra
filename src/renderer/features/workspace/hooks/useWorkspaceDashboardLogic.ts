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
    path: string; name: string; content: string; isDirty: boolean; initialLine?: number;
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
        annotations: Array.isArray(value.annotations) ? value.annotations : [],
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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const analysisRef = useRef<WorkspaceAnalysis | null>(null);

    const summaryCacheKey = `${workspace.id}:${workspace.path}`;

    useEffect(() => {
        setWorkspaceRoot(workspace.path);
        setEditName(workspace.title);
        setEditDesc(workspace.description || '');
        setAnalysis(null);
        setStats(null);
        setLoading(false);
        analysisRef.current = null;
    }, [workspace.description, workspace.id, workspace.path, workspace.title]);

    useEffect(() => {
        analysisRef.current = analysis;
    }, [analysis]);

    useEffect(() => {
        setSelectedFolder(selectedEntry?.isDirectory ? selectedEntry.path : null);
    }, [selectedEntry]);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) { return; }
        setIsSearching(true);
        try {
            const results = await window.electron.code.searchFiles(workspaceRoot, searchQuery, workspace.id);
            setSearchResults(normalizeSearchResults(results));
        } catch (error) {
            setSearchResults([]);
            appLogger.error('WorkspaceDashboard', 'Search failed', error as Error);
        } finally {
            setIsSearching(false);
        }
    };

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
        void loadWorkspaceSummary();
    }, [activeTab, analysis, loadWorkspaceSummary]);

    useVisibilityAwareInterval(() => {
        if (activeTab === 'overview') {
            void loadWorkspaceSummary();
        }
    }, WORKSPACE_ANALYSIS_REFRESH_INTERVAL_MS);

    const handleFileSelect = async (path: string, line?: number) => {
        if (onOpenFile) { return onOpenFile(path, line); }
        if (openFiles.find(f => f.path === path)) {
            setActiveFile(path);
            if (line !== undefined) { setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, initialLine: line } : f)); }
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
    };

    const closeFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const newFiles = openFiles.filter(f => f.path !== path);
        setOpenFiles(newFiles);
        if (activeFile === path) { setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null); }
    };

    const activeFileObj = openFiles.find(f => f.path === activeFile);

    return {
        t,
        state: { stats, analysis, loading, activeTab, workspaceRoot, openFiles, activeFile, selectedFolder, searchQuery, searchResults, isSearching, activeFileObj },
        actions: { setActiveTab, setOpenFiles, setActiveFile, setSearchQuery, handleSearch, analyzeWorkspace, loadWorkspaceSummary, handleFileSelect, closeFile },
        editing: { isEditingName, setIsEditingName, editName, setEditName, handleSaveName, isEditingDesc, setIsEditingDesc, editDesc, setEditDesc, handleSaveDesc }
    };
}
