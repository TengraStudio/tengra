import { FolderInspector } from '@renderer/features/projects/components/ide/FolderInspector';
import { TerminalComponent } from '@renderer/features/projects/components/ide/Terminal';
import { ProjectDashboardHeader } from '@renderer/features/projects/components/ProjectDashboardHeader';
import { ProjectEnvironmentTab } from '@renderer/features/projects/components/ProjectEnvironmentTab';
import { ProjectGitTab } from '@renderer/features/projects/components/ProjectGitTab';
import { ProjectIssuesTab } from '@renderer/features/projects/components/ProjectIssuesTab';
import { ProjectLogsTab } from '@renderer/features/projects/components/ProjectLogsTab';
import { ProjectSettingsPanel } from '@renderer/features/projects/components/ProjectSettingsPanel';
import { ProjectStatsCards } from '@renderer/features/projects/components/ProjectStatsCards';
import { ProjectTodoTab } from '@renderer/features/projects/components/ProjectTodoTab';
import { SearchResults } from '@renderer/features/projects/components/SearchResults';
import { FileSearchResult } from '@shared/types/common';
import { Project } from '@shared/types/project';
import { FileCode, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';
import { AgentCouncil } from '@/features/chat/components/AgentCouncil';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { AgentDefinition, ProjectAnalysis, ProjectDashboardTab, ProjectStats } from '@/types';

interface OpenFile {
    path: string;
    name: string;
    content: string;
    isDirty: boolean;
    initialLine?: number;
}

interface ProjectDashboardProps {
    project: Project;
    onUpdate?: (updates: Partial<Project>) => Promise<void>;
    onOpenLogoGenerator?: () => void;
    language?: Language;
    activeTab?: ProjectDashboardTab;
    onTabChange?: (tab: ProjectDashboardTab) => void;
    onDelete?: () => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string, line?: number) => void;
}

export const ProjectDashboard = ({
    project,
    onUpdate,
    onOpenLogoGenerator,
    language = 'en',
    activeTab: externalTab,
    onTabChange,
    onDelete,
    selectedEntry,
    onOpenFile
}: ProjectDashboardProps) => {
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

    // Inline Editing State
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editName, setEditName] = useState(project.title);
    const [editDesc, setEditDesc] = useState(project.description || '');

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
                console.error('Failed to fetch agents', error);
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

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) { return; }
        setIsSearching(true);
        try {
            const results = await window.electron.code.searchFiles(projectRoot, searchQuery, project.id);
            setSearchResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const analyzeProject = useCallback(async () => {
        setLoading(true);
        try {
            const rootPath = project.path;
            if (rootPath) {
                setProjectRoot(rootPath);
                const data = await window.electron.project.analyze(rootPath, project.id);
                setAnalysis(data);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Project analysis failed:', error);
        } finally {
            setLoading(false);
        }
    }, [project.path, project.id]);

    const handleSaveName = async () => {
        if (editName.trim() && editName !== project.title) {
            await onUpdate?.({ title: editName });
        }
        setIsEditingName(false);
    };

    const handleSaveDesc = async () => {
        if (editDesc !== project.description) {
            await onUpdate?.({ description: editDesc });
        }
        setIsEditingDesc(false);
    };

    useEffect(() => {
        void analyzeProject();
    }, [project.path, project.id, analyzeProject]);

    const handleFileSelect = async (path: string, line?: number) => {
        if (onOpenFile) {
            onOpenFile(path, line);
            return;
        }

        if (openFiles.find(f => f.path === path)) {
            setActiveFile(path);
            if (line !== undefined) {
                setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, initialLine: line } : f));
            }
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
            console.error('Failed to open file', error);
        }
    };

    const closeFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        const newFiles = openFiles.filter(f => f.path !== path);
        setOpenFiles(newFiles);
        if (activeFile === path) {
            setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null);
        }
    };

    if (loading && !analysis) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                {t('projectDashboard.analyzing')}
            </div>
        );
    }

    if (!analysis) {
        return <div className="p-8 text-center text-muted-foreground">{t('projectDashboard.noProject')}</div>;
    }

    const activeFileObj = openFiles.find(f => f.path === activeFile);

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {activeTab === 'overview' && (
                    <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                        <ProjectDashboardHeader
                            project={project}
                            projectRoot={projectRoot}
                            type={analysis.type}
                            loading={loading}
                            isEditingName={isEditingName}
                            setIsEditingName={setIsEditingName}
                            editName={editName}
                            setEditName={setEditName}
                            handleSaveName={handleSaveName}
                            isEditingDesc={isEditingDesc}
                            setIsEditingDesc={setIsEditingDesc}
                            editDesc={editDesc}
                            setEditDesc={setEditDesc}
                            handleSaveDesc={handleSaveDesc}
                            onOpenLogoGenerator={onOpenLogoGenerator}
                            analyzeProject={analyzeProject}
                        />

                        <ProjectStatsCards
                            stats={stats}
                            type={analysis.type}
                            moduleCount={analysis.monorepo?.packages.length ?? Object.keys(analysis.dependencies ?? {}).length}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    {t('projectDashboard.techStack')}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.frameworks.map((fw: string) => (
                                        <span key={fw} className="px-3 py-1 bg-muted/30 border border-border rounded-full text-xs text-primary font-medium">
                                            {fw}
                                        </span>
                                    ))}
                                    {analysis.frameworks.length === 0 && <span className="text-xs text-muted-foreground italic">{t('projectDashboard.noFrameworks')}</span>}
                                </div>
                            </div>

                            <div className="bg-card/40 rounded-2xl border border-border p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                                    {t('projectDashboard.langDist')}
                                </h3>
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                    {Object.entries(analysis.languages)
                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                        .slice(0, 15)
                                        .map(([lang, count]) => {
                                            const percentage = stats ? Math.round(((count as number) / stats.fileCount) * 100) : 0;
                                            return (
                                                <div key={lang} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                                                        <span className="text-foreground/80">{lang}</span>
                                                        <span className="text-muted-foreground">{percentage}%</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                                        <div className="h-full bg-success/50 rounded-full" style={{ width: `${percentage}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>

                        {analysis.todos.length > 0 && (
                            <div className="bg-card/40 rounded-2xl border border-border/50 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow" />
                                    {t('projectDashboard.todoList')}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {analysis.todos.map((todo: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/10 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
                                            <div className="w-4 h-4 rounded border border-border/50 mt-0.5 flex-shrink-0" />
                                            <span className="text-xs text-foreground/80 line-clamp-2">{todo}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-12 pt-8 border-t border-destructive/20">
                            <h3 className="text-lg font-bold text-destructive mb-4 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                {t('projects.dangerZone') || 'Danger Zone'}
                            </h3>
                            <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <h4 className="text-foreground font-medium mb-1">{t('projects.deleteProject') || 'Delete Project'}</h4>
                                    <p className="text-sm text-muted-foreground">{t('projects.deleteWarning') || 'This action cannot be undone.'}</p>
                                </div>
                                <button
                                    onClick={() => { void onDelete?.(); }}
                                    className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg border border-destructive/20 transition-colors text-sm font-medium"
                                >
                                    {t('common.delete') || 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'terminal' && (
                    <div className="h-full bg-black/40 rounded-xl border border-border/50 overflow-hidden p-1">
                        <TerminalComponent cwd={projectRoot} />
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="h-full overflow-hidden">
                        <ProjectTodoTab projectRoot={projectRoot} t={t} />
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex gap-2 bg-card p-4 rounded-xl border border-border">
                            <input
                                type="text"
                                placeholder={t('projectDashboard.searchInProject')}
                                className="flex-1 bg-muted/20 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') {void handleSearch();} }}
                            />
                            <button
                                onClick={() => { void handleSearch(); }}
                                disabled={isSearching || searchQuery.trim().length < 2}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {isSearching ? t('common.searching') : t('common.search')}
                            </button>
                        </div>
                        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col p-2">
                            <SearchResults results={searchResults} projectRoot={projectRoot} onSelect={(path, line) => { void handleFileSelect(path, line); }} />
                        </div>
                    </div>
                )}

                {activeTab === 'council' && <div className="h-full"><AgentCouncil language={language} /></div>}

                {activeTab === 'settings' && (
                    <div className="h-full">
                        <ProjectSettingsPanel
                            project={project}
                            onUpdate={onUpdate ?? (async () => { })}
                            language={language}
                            availableAgents={availableAgents}
                            onAddMount={() => { console.warn('Add mount requested from settings'); }}
                            onRemoveMount={(id) => {
                                const nextMounts = project.mounts.filter(m => m.id !== id);
                                void onUpdate?.({ mounts: nextMounts });
                            }}
                        />
                    </div>
                )}

                {activeTab === 'git' && <ProjectGitTab project={project} t={t} activeTab={activeTab} />}

                {activeTab === 'issues' && (
                    <ProjectIssuesTab
                        analysis={analysis}
                        projectRoot={projectRoot}
                        onOpenFile={(path, line) => { void handleFileSelect(path, line); }}
                        language={language}
                    />
                )}

                {(activeTab === 'env' || activeTab === 'environment') && <ProjectEnvironmentTab projectPath={projectRoot} language={language} />}

                {activeTab === 'logs' && <ProjectLogsTab projectPath={projectRoot} language={language} />}

                {activeTab === 'files' && (
                    <div className="h-full flex gap-4 transition-all duration-300">
                        <div className="flex-1 bg-card rounded-xl border border-border/50 flex flex-col overflow-hidden min-w-0">
                            {openFiles.length > 0 ? (
                                <>
                                    <div className="flex items-center overflow-x-auto border-b border-border/50 bg-muted/20 scrollbar-none">
                                        {openFiles.map(file => (
                                            <div
                                                key={file.path}
                                                onClick={() => { setActiveFile(file.path); }}
                                                className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-border/20 cursor-pointer min-w-[120px] max-w-[200px] ${activeFile === file.path ? 'bg-card text-primary font-medium border-t-2 border-t-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
                                            >
                                                <FileCode size={12} className={activeFile === file.path ? 'text-primary' : 'opacity-50'} />
                                                <span className="truncate flex-1">{file.name}</span>
                                                <button onClick={(e) => closeFile(e, file.path)} className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 relative">
                                        {activeFileObj && (
                                            <CodeEditor
                                                value={activeFileObj.content}
                                                language={activeFileObj.name.split('.').pop() || 'typescript'}
                                                onChange={(newContent) => {
                                                    const newFiles = openFiles.map(f => f.path === activeFileObj.path ? { ...f, content: newContent ?? '', isDirty: true } : f);
                                                    setOpenFiles(newFiles);
                                                }}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                    <div className="w-16 h-16 mb-4 opacity-10 flex items-center justify-center border-2 border-current rounded-full">
                                        <FileCode size={32} />
                                    </div>
                                    <p>{t('projectDashboard.selectFile')}</p>
                                </div>
                            )}
                        </div>
                        <div className={cn("w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-border/50", selectedFolder ? "opacity-100 mr-0" : "opacity-0 w-0 border-0 pointer-events-none")}>
                            <FolderInspector folderPath={selectedFolder} rootPath={projectRoot} />
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};
