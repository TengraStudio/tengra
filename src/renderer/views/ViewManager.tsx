/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { Suspense, useEffect } from 'react';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingState } from '@/components/ui/LoadingState';
import { renderViewSkeleton, ViewSkeletonId } from '@/components/ui/view-skeletons';
import { useAuth, useAuthSettingsUi } from '@/context/AuthContext';
import { useChatListening } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import {
    useWorkspaceLibrary,
    useWorkspaceSelection,
    useWorkspaceTerminal,
} from '@/context/WorkspaceContext';
import { ChatTemplate } from '@/features/chat/types';
import { ExtensionViewHost } from '@/features/extensions/components/ExtensionViewHost';
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { GroupedModels } from '@/types';

import {
    ChatViewWrapperView,
    DockerDashboardView,
    ImageStudioView,
    MarketplaceView,
    ModelsPageView,
    SettingsRouteView,
    WorkspaceRouteView,
} from './view-manager/view-loaders';


/* Batch-02: Extracted Long Classes */
const C_VIEWMANAGER_1 = "absolute top-4 right-4 z-50 cursor-pointer bg-destructive/70 text-destructive-foreground px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse flex items-center gap-2";

interface ViewManagerProps {
    currentView: AppView
    messagesEndRef: React.RefObject<HTMLDivElement>
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    onScrollToBottom: () => void
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
    templates: ChatTemplate[]
    settingsSearchQuery?: string
}

/**
 * Chat component wrapper to isolate hook consumption
 */
const ChatSection: React.FC<Omit<ViewManagerProps, 'currentView'>> = (props) => (
    <ChatViewWrapperView {...props} />
);

/**
 * Workspace component wrapper to isolate hook consumption
 */
const WorkspaceSection: React.FC = () => {
    const {
        workspaces,
    } = useWorkspaceLibrary();
    const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceSelection();
    const { terminalTabs, activeTerminalId, setTerminalTabs, setActiveTerminalId } =
        useWorkspaceTerminal();
    const { language } = useAuth();

    return (
        <WorkspaceRouteView
            workspaces={workspaces}
            selectedWorkspace={selectedWorkspace}
            onSelectWorkspace={setSelectedWorkspace}
            language={language}
            tabs={terminalTabs}
            activeTabId={activeTerminalId}
            setTabs={setTerminalTabs}
            setActiveTabId={setActiveTerminalId}
        />
    );
};

/**
 * Settings component wrapper to isolate hook consumption
 */
const SettingsSection: React.FC = () => {
    const { settingsCategory, setSettingsCategory } = useAuthSettingsUi();
    const { models, proxyModels, loadModels, groupedModels } = useModel();

    const group = groupedModels && (groupedModels as GroupedModels)['ollama'];
    const ollamaModels = group ? group.models : undefined;
    const installedModels = Array.isArray(ollamaModels) && ollamaModels.length > 0
        ? ollamaModels
        : models.filter(m => m.provider === 'ollama');

    return (
        <SettingsRouteView
            installedModels={installedModels}
            proxyModels={proxyModels}
            loadModels={(bypassCache) => void loadModels(bypassCache)}
            settingsCategory={settingsCategory}
            onSettingsCategoryChange={setSettingsCategory}
            groupedModels={groupedModels}
        />
    );
};

const DockerSection: React.FC = () => {
    const { handleOpenTerminal } = useWorkspaceTerminal();
    const { language } = useAuth();

    return (
        <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
            <Suspense fallback={<LoadingState size="md" />}>
                <DockerDashboardView onOpenTerminal={handleOpenTerminal} language={language} />
            </Suspense>
        </div>
    );
};

const ModelsSection: React.FC = () => {
    const { language } = useAuth();

    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <ModelsPageView language={language} />
        </Suspense>
    );
};

const ImagesSection: React.FC = () => (
    <Suspense fallback={<LoadingState size="md" />}>
        <ImageStudioView />
    </Suspense>
);


const TerminalPlaceholderSection: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="h-full p-6 flex flex-col items-center justify-center bg-tech-grid opacity-50">
            <div className="text-muted-foreground text-sm font-mono border border-border/50 p-4 rounded-xl">
                {t('frontend.terminal.dashboardPlaceholder')}
            </div>
        </div>
    );
};

const ModelMenuHotkeyHandler: React.FC = () => {
    const { setIsModelMenuOpen } = useModel();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'm') {
                setIsModelMenuOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setIsModelMenuOpen]);

    return null;
};

const ListeningOverlay: React.FC = () => {
    const { stopListening, isListening } = useChatListening();
    const { t } = useTranslation();

    if (!isListening) {
        return null;
    }

    return (
        <div
            onClick={() => stopListening()}
            className={C_VIEWMANAGER_1}
        >
            <div className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span className="text-sm font-bold text-sm">
                {t('frontend.audioChat.listeningLabel')}
            </span>
        </div>
    );
};

export const ViewManager: React.FC<ViewManagerProps> = (props) => {
    const { currentView } = props;

    const renderView = () => {
        switch (currentView) {
            case 'chat': return <ChatSection {...props} />;
            case 'workspace': return <WorkspaceSection />;
            case 'settings': return <SettingsSection />;
            case 'mcp': return <DockerSection />;
            case 'models': return <ModelsSection />;
            case 'images': return <ImagesSection />;
            case 'docker': return <DockerSection />;
            case 'terminal': return <TerminalPlaceholderSection />;
            case 'marketplace': return <Suspense fallback={<LoadingState size="md" />}><MarketplaceView /></Suspense>;
            default: {
                // If it's not a core view, check if it's an extension view
                return <ExtensionViewHost viewId={currentView} />;
            }
        }
    };

    return (
        <>
            <ModelMenuHotkeyHandler />
            <div key={currentView} className={cn("h-full overflow-hidden")}>
                <ErrorBoundary resetKeys={[currentView]}>
                    <Suspense fallback={renderViewSkeleton(
                        ['chat', 'workspace', 'settings', 'mcp', 'agent', 'models', 'docker', 'terminal', 'marketplace', 'images'].includes(currentView)
                            ? currentView as ViewSkeletonId
                            : 'marketplace'
                    )}>
                        {renderView()}
                    </Suspense>
                </ErrorBoundary>
            </div>
            <ListeningOverlay />
        </>
    );
};


