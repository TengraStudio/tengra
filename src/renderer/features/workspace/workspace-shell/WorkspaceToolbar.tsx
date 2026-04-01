import {
    ArrowLeft,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    Pencil,
} from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { WorkspaceDashboardTab } from '@/types';

import { DashboardTabs } from './DashboardTabs';

interface WorkspaceToolbarProps {
    workspaceName: string;
    onNameChange: (name: string) => void;
    onBack: () => void;
    toggleSidebar: () => void;
    sidebarCollapsed: boolean;
    language: Language;
    dashboardTab: WorkspaceDashboardTab;
    onDashboardTabChange?: (tab: WorkspaceDashboardTab) => void;
    handleRunWorkspace: () => void;
    showAgentPanel: boolean;
    toggleAgentPanel: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
    workspaceName,
    onNameChange,
    onBack,
    toggleSidebar,
    sidebarCollapsed,
    language,
    dashboardTab,
    onDashboardTabChange,
    handleRunWorkspace,
    showAgentPanel,
    toggleAgentPanel,
}) => {
    const { t } = useTranslation(language);
    const [isEditingName, setIsEditingName] = React.useState(false);
    const [editedName, setEditedName] = React.useState(workspaceName);
    const nameInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isEditingName) {
            nameInputRef.current?.focus();
        }
    }, [isEditingName]);

    const handleNameSubmit = () => {
        if (editedName.trim() && editedName !== workspaceName) {
            void onNameChange(editedName);
        } else {
            setEditedName(workspaceName);
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            setEditedName(workspaceName);
            setIsEditingName(false);
        }
    };

    return (
        <div className="h-14 border-b border-border/40 bg-background flex items-center justify-between px-4 shrink-0 relative z-20">
            {/* Left Section: Back & Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                <button
                    onClick={onBack}
                    data-testid="workspace-back-button"
                    className="p-1.5 hover:bg-muted/60 rounded-md text-muted-foreground hover:text-foreground transition-colors"
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
                                onChange={e => setEditedName(e.target.value)}
                                onBlur={handleNameSubmit}
                                onKeyDown={handleKeyDown}
                                className="bg-muted/60 text-sm font-medium px-1.5 py-0.5 rounded border border-border/60 focus:outline-none focus:border-primary/50 text-foreground tw-min-w-200"
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditingName(true)}
                                className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 px-1.5 py-0.5 -ml-1.5 rounded transition-colors"
                            >
                                <span className="font-medium text-sm text-foreground truncate max-tw-w-300">
                                    {workspaceName}
                                </span>
                                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Center Toolbar */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
                {/* Sidebar Toggle */}
                <button
                    onClick={toggleSidebar}
                    className={cn(
                        'p-1.5 rounded-md transition-colors',
                        sidebarCollapsed
                            ? 'text-muted-foreground hover:text-foreground'
                            : 'text-foreground bg-muted/60'
                    )}
                    title={t('workspace.toggleSidebar')}
                >
                    {sidebarCollapsed ? (
                        <PanelLeftOpen className="w-3.5 h-3.5" />
                    ) : (
                        <PanelLeftClose className="w-3.5 h-3.5" />
                    )}
                </button>
                <div className="w-px h-4 bg-muted/60 mx-2" />

                <DashboardTabs
                    dashboardTab={dashboardTab}
                    {...(onDashboardTabChange ? { onDashboardTabChange } : {})}
                    handleRunWorkspace={handleRunWorkspace}
                    t={t}
                />
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={toggleAgentPanel}
                    className={cn(
                        'p-1.5 rounded-md transition-colors',
                        showAgentPanel
                            ? 'text-foreground bg-muted/60'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    title={t('workspace.toggleAgentPanel')}
                >
                    {showAgentPanel ? (
                        <PanelRightClose className="w-3.5 h-3.5" />
                    ) : (
                        <PanelRightOpen className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>
        </div>
    );
};
