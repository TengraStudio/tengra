import React from 'react';
import { ArrowLeft, Play, Terminal, Search, PanelRightClose, PanelRightOpen, Pencil, GitBranch, PanelLeftClose, PanelLeftOpen, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/types';
import { useTranslation, Language } from '@/i18n';


interface WorkspaceToolbarProps {
    project: Project;
    onBack: () => void;
    onUpdate?: (updates: Partial<Project>) => Promise<void>;
    handleRunProject: () => void;
    showTerminal: boolean;
    toggleTerminal: () => void;
    showAgentPanel: boolean;
    toggleAgentPanel: () => void;
    language: Language;
    // New props for dashboard tabs
    dashboardTab?: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor';
    onDashboardTabChange?: (tab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor') => void;
    // Sidebar toggle
    sidebarCollapsed?: boolean;
    toggleSidebar?: () => void;
}

/**
 * WorkspaceToolbar Component
 * 
 * Provides global actions for the project workspace:
 * - Back to projects list
 * - Run project and terminal toggle
 * - Global search
 * - AI Assistant panel toggle
 */
export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
    project,
    onBack,
    onUpdate,
    handleRunProject,
    showTerminal: _showTerminal,
    toggleTerminal: _toggleTerminal,
    showAgentPanel,
    toggleAgentPanel,
    language,
    dashboardTab = 'overview',
    onDashboardTabChange,
    sidebarCollapsed = false,
    toggleSidebar
}) => {
    const { t } = useTranslation(language);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editTitle, setEditTitle] = React.useState(project.title);

    const handleSaveTitle = async () => {
        if (editTitle.trim() && editTitle !== project.title) {
            await onUpdate?.({ title: editTitle });
        }
        setIsEditing(false);
    };

    return (
        <div className="h-10 border-b border-white/5 bg-background/50 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-40 select-none">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col justify-center">
                    {isEditing ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                            <input
                                autoFocus
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                                className="text-sm font-bold bg-white/5 border border-primary/50 rounded px-1.5 py-0.5 outline-none text-white w-48"
                            />
                        </div>
                    ) : (
                        <h1
                            onClick={() => setIsEditing(true)}
                            className="text-sm font-bold tracking-tight text-white flex items-center gap-2 group cursor-pointer hover:text-primary transition-colors"
                        >
                            {project.title}
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 uppercase tracking-wider border border-emerald-500/20">{t('workspace.dev')}</span>
                        </h1>
                    )}
                </div>
            </div>

            {/* Center Toolbar */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
                {/* Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className={cn("p-1.5 rounded-md transition-colors", sidebarCollapsed ? "text-muted-foreground hover:text-white" : "text-white bg-white/10")}
                    title={t('workspace.toggleSidebar')}
                >
                    {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
                </button>
                <div className="w-px h-4 bg-white/10 mx-2" />

                {/* Dashboard Tabs */}
                <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5 shadow-sm gap-0.5">
                    <button
                        onClick={() => onDashboardTabChange?.('overview')}
                        className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'overview' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                        title={t('projectDashboard.overview')}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDashboardTabChange?.('terminal')}
                        className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'terminal' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                        title={t('projectDashboard.terminal')}
                    >
                        <Terminal className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleRunProject} className="p-1.5 rounded-md hover:bg-white/10 text-emerald-400 transition-colors" title={t('workspace.run')}>
                        <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                        onClick={() => onDashboardTabChange?.('search')}
                        className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'search' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                        title={t('projectDashboard.search')}
                    >
                        <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDashboardTabChange?.('git')}
                        className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'git' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                        title="Git"
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">{t('workspace.online')}</span>
                </div>
                <button
                    onClick={toggleAgentPanel}
                    className={cn(
                        "p-1.5 rounded-md transition-all border ml-2",
                        showAgentPanel ? "bg-primary/10 text-primary border-primary/20" : "bg-transparent text-muted-foreground border-transparent hover:bg-white/5 hover:text-white"
                    )}
                    title={t('workspace.aiAssistant')}
                >
                    {showAgentPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
};
