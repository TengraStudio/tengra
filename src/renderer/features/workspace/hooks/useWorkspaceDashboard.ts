import { FileSearchResult } from '@shared/types/common';
import { useCallback, useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AgentDefinition, Workspace, WorkspaceAnalysis, WorkspaceDashboardTab, WorkspaceStats } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useDashboardInlineEdit } from './useDashboardInlineEdit';

export interface OpenFile {
    path: string
    name: string
    content: string
    isDirty: boolean
    initialLine?: number
}

interface UseWorkspaceDashboardProps {
    workspace: Workspace
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>
    language: Language
    externalTab?: WorkspaceDashboardTab
    onTabChange?: (tab: WorkspaceDashboardTab) => void
    selectedEntry?: { path: string; isDirectory: boolean } | null
    onOpenFile?: (path: string, line?: number) => void
}

export const useWorkspaceDashboard = ({
    workspace,
    onUpdate,
    language,
    externalTab,
    onTabChange,
    selectedEntry,
    onOpenFile
}: UseWorkspaceDashboardProps) => {
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

    // Isolated inline editing logic
    const inlineEdit = useDashboardInlineEdit({ workspace, onUpdate });

    // Search and Agents State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [availableAgents, setAvailableAgents] = useState<AgentDefinition[]>([]);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const agents = await window.electron.agent.getAll();
                setAvailableAgents(agents as AgentDefinition[]);
            } catch (error) {
                appLogger.error('WorkspaceDashboard', 'Failed to fetch agents', error as Error);
            }
        };
        void fetchAgents();
    }, []);

    useEffect(() => {
        if (selectedEntry?.isDirectory) {
            setSelectedFolder(selectedEntry.path);
        } else {
            setSelectedFolder(null);
        }
    }, [selectedEntry]);

    useEffect(() => {
        setWorkspaceRoot(workspace.path);
    }, [workspace.path]);

    const analyzeWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.workspace.analyze(workspace.path, workspace.id);
            setAnalysis(result as WorkspaceAnalysis);
            if (result.stats) { setStats(result.stats); }
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Analysis failed', error as Error);
        } finally {
            setLoading(false);
        }
    }, [workspace.path, workspace.id]);

    useEffect(() => {
        void analyzeWorkspace();
        const interval = setInterval(() => { void analyzeWorkspace(); }, 60000);
        return () => clearInterval(interval);
    }, [analyzeWorkspace]);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) { return; }
        setIsSearching(true);
        try {
            const results = await window.electron.code.searchFiles(workspace.path, searchQuery, workspace.id);
            setSearchResults(results);
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Search failed', error as Error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFileSelect = async (path: string, line?: number) => {
        try {
            const content = await window.electron.files.readFile(path);
            const name = path.split(/[\\/]/).pop() ?? 'Untitled';
            const existing = openFiles.find(f => f.path === path);
            if (!existing) {
                setOpenFiles([...openFiles, { path, name, content, isDirty: false, initialLine: line }]);
            }
            setActiveFile(path);
            setActiveTab('files');
            onOpenFile?.(path, line);
        } catch (error) {
            appLogger.error('WorkspaceDashboard', 'Failed to read file', error as Error);
        }
    };

    const closeFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const nextFiles = openFiles.filter(f => f.path !== path);
        setOpenFiles(nextFiles);
        if (activeFile === path) {
            setActiveFile(nextFiles.length > 0 ? nextFiles[nextFiles.length - 1].path : null);
        }
    };

    return {
        t, stats, analysis, loading, activeTab, setActiveTab, workspaceRoot, openFiles, setOpenFiles,
        activeFile, setActiveFile, selectedFolder, searchQuery, setSearchQuery, searchResults,
        isSearching, availableAgents, analyzeWorkspace, handleSearch, handleFileSelect, closeFile,
        ...inlineEdit
    };
};
