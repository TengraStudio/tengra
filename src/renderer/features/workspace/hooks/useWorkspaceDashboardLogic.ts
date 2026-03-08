
import { FileSearchResult } from '@shared/types/common';
import { useCallback, useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import type { AgentDefinition, Workspace, WorkspaceAnalysis, WorkspaceDashboardTab, WorkspaceStats } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

const WORKSPACE_ANALYSIS_REFRESH_INTERVAL_MS = 90_000;

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

export function useWorkspaceDashboardLogic({ workspace, activeTab: externalTab, onTabChange, selectedEntry, onOpenFile, onUpdate, language = 'en' }: UseWorkspaceDashboardLogicProps) {
    const { t } = useTranslation(language);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [analysis, setAnalysis] = useState<WorkspaceAnalysis | null>(null);
    const [loading, setLoading] = useState(true); // Start with loading state to prevent empty state flash
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
    const [availableAgents, setAvailableAgents] = useState<AgentDefinition[]>([]);

    useEffect(() => {
        window.electron.agent.getAll()
            .then(a => setAvailableAgents(a as AgentDefinition[]))
            .catch(e => appLogger.error('WorkspaceDashboard', 'Failed to fetch agents', e as Error));
    }, []);

    useEffect(() => {
        setSelectedFolder(selectedEntry?.isDirectory ? selectedEntry.path : null);
    }, [selectedEntry]);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) { return; }
        setIsSearching(true);
        try {
            setSearchResults(await window.electron.code.searchFiles(workspaceRoot, searchQuery, workspace.id));
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Search failed', error as Error);
        } finally {
            setIsSearching(false);
        }
    };

    const analyzeWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            if (workspace.path) {
                setWorkspaceRoot(workspace.path);
                const data = await window.electron.workspace.analyze(workspace.path, workspace.id);
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

    useEffect(() => { void analyzeWorkspace(); }, [workspace.path, workspace.id, analyzeWorkspace]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (document.hidden) {
                return;
            }
            void analyzeWorkspace();
        }, WORKSPACE_ANALYSIS_REFRESH_INTERVAL_MS);
        return () => {
            window.clearInterval(timer);
        };
    }, [analyzeWorkspace]);

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
            setOpenFiles([...openFiles, { path, name, content, isDirty: false, initialLine: line }]);
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
        state: { stats, analysis, loading, activeTab, workspaceRoot, openFiles, activeFile, selectedFolder, searchQuery, searchResults, isSearching, availableAgents, activeFileObj },
        actions: { setActiveTab, setOpenFiles, setActiveFile, setSearchQuery, handleSearch, analyzeWorkspace, handleFileSelect, closeFile },
        editing: { isEditingName, setIsEditingName, editName, setEditName, handleSaveName, isEditingDesc, setIsEditingDesc, editDesc, setEditDesc, handleSaveDesc }
    };
}
