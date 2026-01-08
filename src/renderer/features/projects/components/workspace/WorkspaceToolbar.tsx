import React from 'react';
import { ArrowLeft, Play, Terminal, Search, PanelRightClose, PanelRightOpen, Settings, Pencil } from 'lucide-react';
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
    handleSearch: () => void;
    showAgentPanel: boolean;
    toggleAgentPanel: () => void;
    toggleSettings: () => void;
    onOpenGit?: () => void;
    language: Language;
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
    showTerminal,
    toggleTerminal,
    handleSearch,
    showAgentPanel,
    toggleAgentPanel,
    toggleSettings,
    onOpenGit,
    language
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
        <div className="h-10 border-b border-white/5 bg-background/50 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-10 select-none">
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
                <div className="flex items-center bg-white/5 rounded-md p-0.5 border border-white/5 shadow-sm">
                    <button onClick={handleRunProject} className="p-1.5 rounded-sm hover:bg-white/10 text-emerald-400 transition-colors" title={t('workspace.run')}>
                        <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button onClick={toggleTerminal} className={cn("p-1.5 rounded-sm transition-colors", showTerminal ? "text-white bg-white/10" : "text-muted-foreground hover:text-white")} title={t('workspace.terminal')}>
                        <Terminal className="w-3.5 h-3.5" />
                    </button>
                </div>
                <button onClick={handleSearch} className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors ml-2" title={t('workspace.search')}>
                    <Search className="w-4 h-4" />
                </button>
                <button
                    onClick={toggleSettings}
                    className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors ml-1"
                    title={t('settings.projectSettings')}
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => onOpenGit?.()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md border border-white/5 text-xs font-medium transition-colors group"
                    title="Git Commit"
                >
                    <div className="w-2 h-2 rounded-full bg-orange-400 group-hover:animate-pulse" />
                    <span className="text-muted-foreground group-hover:text-white">Git</span>
                </button>
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
