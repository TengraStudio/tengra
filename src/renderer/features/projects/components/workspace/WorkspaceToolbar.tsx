import React from 'react';
import { ArrowLeft, Play, Terminal, Search, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

interface WorkspaceToolbarProps {
    project: Project;
    onBack: () => void;
    handleRunProject: () => void;
    showTerminal: boolean;
    toggleTerminal: () => void;
    handleSearch: () => void;
    showAgentPanel: boolean;
    toggleAgentPanel: () => void;
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
    handleRunProject,
    showTerminal,
    toggleTerminal,
    handleSearch,
    showAgentPanel,
    toggleAgentPanel
}) => {
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
                    <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                        {project.title}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 uppercase tracking-wider border border-emerald-500/20">Dev</span>
                    </h1>
                </div>
            </div>

            {/* Center Toolbar */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
                <div className="flex items-center bg-white/5 rounded-md p-0.5 border border-white/5 shadow-sm">
                    <button onClick={handleRunProject} className="p-1.5 rounded-sm hover:bg-white/10 text-emerald-400 transition-colors" title="Ã‡alÄ±ÅŸtÄ±r (F5)">
                        <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    <button onClick={toggleTerminal} className={cn("p-1.5 rounded-sm transition-colors", showTerminal ? "text-white bg-white/10" : "text-muted-foreground hover:text-white")} title="Terminal (Ctrl+`)">
                        <Terminal className="w-3.5 h-3.5" />
                    </button>
                </div>
                <button onClick={handleSearch} className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors ml-2" title="Dosya Ara (Cmd+P)">
                    <Search className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Online</span>
                </div>
                <button
                    onClick={toggleAgentPanel}
                    className={cn(
                        "p-1.5 rounded-md transition-all border ml-2",
                        showAgentPanel ? "bg-primary/10 text-primary border-primary/20" : "bg-transparent text-muted-foreground border-transparent hover:bg-white/5 hover:text-white"
                    )}
                    title="AI AsistanÄ±"
                >
                    {showAgentPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
};
