
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil } from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Project } from '@/types';

import { DashboardTabs } from './DashboardTabs';

interface WorkspaceToolbarProps {
    project: Project;
    projectName: string;
    description: string;
    onNameChange: (name: string) => void;
    onDescriptionChange: (desc: string) => void;
    onBack: () => void;
    toggleSidebar: () => void;
    sidebarCollapsed: boolean;
    language: Language;
    dashboardTab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor';
    onDashboardTabChange?: (tab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor') => void;
    handleRunProject: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
    project,
    projectName,
    description,
    onNameChange,
    onDescriptionChange,
    onBack,
    toggleSidebar,
    sidebarCollapsed,
    language,
    dashboardTab,
    onDashboardTabChange,
    handleRunProject
}) => {
    const { t } = useTranslation(language);
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [editedName, setEditedName] = React.useState(projectName);
    const nameInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isEditingName) {
            nameInputRef.current?.focus();
        }
    }, [isEditingName]);

    const handleNameSubmit = () => {
        if (editedName.trim() && editedName !== projectName) {
            void onNameChange(editedName);
        } else {
            setEditedName(projectName);
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            setEditedName(projectName);
            setIsEditingName(false);
        }
    };

    return (
        <div className="h-14 border-b border-white/10 bg-black/40 flex items-center justify-between px-4 shrink-0 relative z-20">
            {/* Left Section: Back & Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                <button
                    onClick={onBack}
                    className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 group">
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onBlur={handleNameSubmit}
                                onKeyDown={handleKeyDown}
                                className="bg-white/10 text-sm font-medium px-1.5 py-0.5 rounded border border-white/20 focus:outline-none focus:border-primary/50 text-white min-w-[200px]"
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingName(true)}
                                className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1.5 py-0.5 -ml-1.5 rounded transition-colors"
                            >
                                <span className="font-medium text-sm text-white truncate max-w-[300px]">
                                    {projectName}
                                </span>
                                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                        <div className="px-1.5 py-0.5 rounded text-[10px] uppercase font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {project.type}
                        </div>
                    </div>
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

                <DashboardTabs
                    dashboardTab={dashboardTab}
                    {...(onDashboardTabChange ? { onDashboardTabChange } : {})}
                    handleRunProject={handleRunProject}
                    t={t}
                />
            </div>

            <div className="flex items-center gap-3">
                {/* Right actions if any */}
            </div>
        </div>
    );
};
