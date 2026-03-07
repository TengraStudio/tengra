import { FileSearchResult } from '@shared/types/common';
import { useCallback, useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AgentDefinition, Project, ProjectAnalysis, ProjectDashboardTab, ProjectStats } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useDashboardInlineEdit } from './useDashboardInlineEdit';

export interface OpenFile {
    path: string
    name: string
    content: string
    isDirty: boolean
    initialLine?: number
}

interface UseProjectDashboardProps {
    project: Project
    onUpdate?: (updates: Partial<Project>) => Promise<void>
    language: Language
    externalTab?: ProjectDashboardTab
    onTabChange?: (tab: ProjectDashboardTab) => void
    selectedEntry?: { path: string; isDirectory: boolean } | null
    onOpenFile?: (path: string, line?: number) => void
}

export const useProjectDashboard = ({
    project,
    onUpdate,
    language,
    externalTab,
    onTabChange,
    selectedEntry,
    onOpenFile
}: UseProjectDashboardProps) => {
    const { t } = useTranslation(language);
    const [stats, setStats] = useState<ProjectStats | null>(null);
    const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [internalTab, setInternalTab] = useState<ProjectDashboardTab>('overview');

    const activeTab = externalTab ?? internalTab;
    const setActiveTab = (onTabChange ?? setInternalTab) as (tab: ProjectDashboardTab) => void;

    const [projectRoot, setProjectRoot] = useState<string>(project.path);
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

    // Isolated inline editing logic
    const inlineEdit = useDashboardInlineEdit({ project, onUpdate });

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
                appLogger.error('ProjectDashboard', 'Failed to fetch agents', error as Error);
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
        setProjectRoot(project.path);
    }, [project.path]);

    const analyzeProject = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.workspace.analyze(project.path, project.id);
            setAnalysis(result as ProjectAnalysis);
            if (result.stats) { setStats(result.stats); }
        } catch (error) {
            appLogger.error('ProjectDashboard', 'Analysis failed', error as Error);
        } finally {
            setLoading(false);
        }
    }, [project.path, project.id]);

    useEffect(() => {
        void analyzeProject();
        const interval = setInterval(() => { void analyzeProject(); }, 60000);
        return () => clearInterval(interval);
    }, [analyzeProject]);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) { return; }
        setIsSearching(true);
        try {
            const results = await window.electron.code.searchFiles(project.path, searchQuery, project.id);
            setSearchResults(results);
        } catch (error) {
            appLogger.error('ProjectDashboard', 'Search failed', error as Error);
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
            appLogger.error('ProjectDashboard', 'Failed to read file', error as Error);
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
        t, stats, analysis, loading, activeTab, setActiveTab, projectRoot, openFiles, setOpenFiles,
        activeFile, setActiveFile, selectedFolder, searchQuery, setSearchQuery, searchResults,
        isSearching, availableAgents, analyzeProject, handleSearch, handleFileSelect, closeFile,
        ...inlineEdit
    };
};
