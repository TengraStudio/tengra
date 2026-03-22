import { useChatListening } from '@renderer/context/ChatContext';
import { useModel } from '@renderer/context/ModelContext';
import {
    useWorkspaceLibrary,
    useWorkspaceSelection,
    useWorkspaceTerminal,
} from '@renderer/context/WorkspaceContext';
import { ChatTemplate } from '@renderer/features/chat/types';
import { AppView } from '@renderer/hooks/useAppState';
import React, { Suspense, useEffect, useMemo } from 'react';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingState } from '@/components/ui/LoadingState';
import { renderViewSkeleton } from '@/components/ui/view-skeletons';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import {
    getAnimationDurationMs,
    resolveAnimationPreset,
    usePrefersReducedMotion,
} from '@/lib/animation-system';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { trackAnimationEvent } from '@/store/animation-analytics.store';
import type { GroupedModels } from '@/types';

import {
    ChatViewWrapperView,
    DockerDashboardView,
    IdeasPageView,
    MemoryInspectorView,
    ModelsPageView,
    SettingsRouteView,
    WorkspaceRouteView,
} from './view-manager/view-loaders';

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
    onNavigateToWorkspace?: (workspaceId: string) => void | Promise<void>
    settingsSearchQuery?: string
}

/**
 * Chat component wrapper to isolate hook consumption
 */
const ChatSection: React.FC<Omit<ViewManagerProps, 'currentView' | 'onNavigateToWorkspace'>> = (props) => (
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
    const { settingsCategory } = useAuth();
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

const IdeasSection: React.FC<{
    onNavigateToWorkspace?: (workspaceId: string) => void | Promise<void>
}> = ({ onNavigateToWorkspace }) => {
    const { language } = useAuth();

    return (
        <Suspense fallback={<LoadingState size="md" />}>
            <IdeasPageView
                language={language}
                onNavigateToWorkspace={(id: string) => void onNavigateToWorkspace?.(id)}
            />
        </Suspense>
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

const TerminalPlaceholderSection: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="h-full p-6 flex flex-col items-center justify-center bg-tech-grid opacity-50">
            <div className="text-muted-foreground text-sm font-mono border border-border/50 p-4 rounded-xl">
                {t('terminal.dashboardPlaceholder')}
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
            className="absolute top-4 right-4 z-[9999] cursor-pointer bg-destructive/70 text-destructive-foreground px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse flex items-center gap-2"
        >
            <div className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-xxs">
                {t('audioChat.listeningLabel')}
            </span>
        </div>
    );
};

export const ViewManager: React.FC<ViewManagerProps> = (props) => {
    const { currentView, onNavigateToWorkspace } = props;
    const prefersReducedMotion = usePrefersReducedMotion();

    const pagePreset = useMemo(
        () => resolveAnimationPreset('page', prefersReducedMotion),
        [prefersReducedMotion]
    );

    useEffect(() => {
        trackAnimationEvent({
            name: `view-transition:${currentView}`,
            preset: 'page',
            durationMs: getAnimationDurationMs('page', prefersReducedMotion),
            reducedMotion: prefersReducedMotion,
        });
    }, [currentView, prefersReducedMotion]);

    const renderView = () => {
        switch (currentView) {
            case 'chat': return <ChatSection {...props} />;
            case 'workspace': return <WorkspaceSection />;
            case 'settings': return <SettingsSection />;
            case 'mcp': return <DockerSection />;
            case 'memory': return <Suspense fallback={<LoadingState size="md" />}><MemoryInspectorView /></Suspense>;
            case 'ideas': return <IdeasSection onNavigateToWorkspace={onNavigateToWorkspace} />;
            case 'models': return <ModelsSection />;
            case 'docker': return <DockerSection />;
            case 'terminal': return <TerminalPlaceholderSection />;
            default: return null;
        }
    };

    return (
        <>
            <ModelMenuHotkeyHandler />
            <AnimatePresence initial={false}>
                <motion.div
                    key={currentView}
                    className={cn("h-full overflow-hidden", currentView === 'memory' && "h-[calc(100vh-64px)]")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: pagePreset.duration, ease: pagePreset.ease }}
                    style={{ willChange: 'opacity' }}
                >
                    <ErrorBoundary resetKeys={[currentView]}>
                        <Suspense fallback={renderViewSkeleton(currentView)}>
                            {renderView()}
                        </Suspense>
                    </ErrorBoundary>
                </motion.div>
            </AnimatePresence>
            <ListeningOverlay />
        </>
    );
};

