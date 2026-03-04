import { useAuth } from '@renderer/context/AuthContext';
import { useChat } from '@renderer/context/ChatContext';
import { useModel } from '@renderer/context/ModelContext';
import { useWorkspace } from '@renderer/context/WorkspaceContext';
import { ChatTemplate } from '@renderer/features/chat/types';
import React, { lazy, Suspense, useEffect, useMemo } from 'react';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoadingState } from '@/components/ui/LoadingState';
import { renderViewSkeleton } from '@/components/ui/view-skeletons';
import { Language, useTranslation } from '@/i18n';
import {
    getAnimationDurationMs,
    resolveAnimationPreset,
    usePrefersReducedMotion,
} from '@/lib/animation-system';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { trackAnimationEvent } from '@/store/animation-analytics.store';
import type { GroupedModels } from '@/types';

// Lazy load feature modules

const DockerDashboard = lazy(() => import('@/features/mcp/DockerDashboard').then(m => ({ default: m.DockerDashboard })));
const MemoryInspector = lazy(() => import('@/features/memory/components/MemoryInspector').then(m => ({ default: m.MemoryInspector })));
const IdeasPage = lazy(() => import('@/features/ideas/IdeasPage').then(m => ({ default: m.IdeasPage })));
const AutomationWorkflowView = lazy(() => import('@/features/automation-workflow/AutomationWorkflowView').then(m => ({ default: m.AutomationWorkflowView })));
const ModelsPage = lazy(() => import('@/features/models/pages/ModelsPage').then(m => ({ default: m.ModelsPage })));

import { AppView } from '@renderer/hooks/useAppState';

const ChatViewWrapper = lazy(() => import('./view-manager/ChatViewWrapper').then(m => ({ default: m.ChatViewWrapper })));
const WorkspaceView = lazy(() => import('@/features/workspace/WorkspacePage').then(m => ({ default: m.MemoizedWorkspacesPage })));
const SettingsView = lazy(() => import('./view-manager/SettingsView').then(m => ({ default: m.SettingsView })));
const WorkflowsPage = lazy(() => import('@/features/workflows/WorkflowsPage').then(m => ({ default: m.WorkflowsPage })));

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
    onNavigateToProject?: (projectId: string) => void | Promise<void>
    settingsSearchQuery?: string
}

/**
 * Chat component wrapper to isolate hook consumption
 */
const ChatSection: React.FC<Omit<ViewManagerProps, 'currentView' | 'onNavigateToProject'>> = (props) => (
    <ChatViewWrapper {...props} />
);

/**
 * Workspace component wrapper to isolate hook consumption
 */
const WorkspaceSection: React.FC<{ language: Language }> = ({ language }) => {
    const {
        projects, selectedProject, setSelectedProject,
        terminalTabs, activeTerminalId, setTerminalTabs, setActiveTerminalId
    } = useWorkspace();
    const {
        selectedProvider, selectedModel, setSelectedProvider, setSelectedModel,
        persistLastSelection, groupedModels
    } = useModel();
    const { quotas, codexUsage, settings } = useAuth();
    const { isLoading, handleSend, messages, chatError } = useChat();

    return (
        <WorkspaceView
            workspaces={projects}
            selectedWorkspace={selectedProject}
            onSelectWorkspace={setSelectedProject}
            language={language}
            tabs={terminalTabs}
            activeTabId={activeTerminalId}
            setTabs={setTerminalTabs}
            setActiveTabId={setActiveTerminalId}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelectModel={(p, m) => {
                setSelectedProvider(p);
                setSelectedModel(m);
                void persistLastSelection(p, m);
            }}
            groupedModels={groupedModels ?? undefined}
            quotas={quotas}
            codexUsage={codexUsage}
            settings={settings}
            sendMessage={content => {
                void handleSend(content);
            }}
            messages={messages}
            isLoading={isLoading}
            chatError={chatError}
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
        <SettingsView
            installedModels={installedModels}
            proxyModels={proxyModels}
            loadModels={(bypassCache) => void loadModels(bypassCache)}
            settingsCategory={settingsCategory}
            groupedModels={groupedModels}
        />
    );
};

export const ViewManager: React.FC<ViewManagerProps> = (props) => {
    const { currentView, onNavigateToProject } = props;
    const { language } = useAuth();
    const { t } = useTranslation(language);
    const { stopListening, isListening } = useChat();
    const { setIsModelMenuOpen } = useModel();
    const { handleOpenTerminal } = useWorkspace();
    const prefersReducedMotion = usePrefersReducedMotion();

    const pagePreset = useMemo(
        () => resolveAnimationPreset('page', prefersReducedMotion),
        [prefersReducedMotion]
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'm') { setIsModelMenuOpen(prev => !prev); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setIsModelMenuOpen]);

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
            case 'workspace': return <WorkspaceSection language={language} />;
            case 'settings': return <SettingsSection />;
            case 'mcp': return (
                <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
                    <Suspense fallback={<LoadingState size="md" />}><DockerDashboard onOpenTerminal={handleOpenTerminal} language={language} /></Suspense>
                </div>
            );
            case 'memory': return <Suspense fallback={<LoadingState size="md" />}><MemoryInspector /></Suspense>;
            case 'ideas': return <Suspense fallback={<LoadingState size="md" />}><IdeasPage language={language} onNavigateToProject={(id) => void onNavigateToProject?.(id)} /></Suspense>;
            case 'automation-workflow': return <Suspense fallback={<LoadingState size="md" />}><AutomationWorkflowView /></Suspense>;
            case 'models': return <Suspense fallback={<LoadingState size="md" />}><ModelsPage language={language} /></Suspense>;
            case 'docker': return (
                <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
                    <Suspense fallback={<LoadingState size="md" />}><DockerDashboard onOpenTerminal={handleOpenTerminal} language={language} /></Suspense>
                </div>
            );
            case 'terminal': return (
                <div className="h-full p-6 flex flex-col items-center justify-center bg-tech-grid opacity-50">
                    <div className="text-muted-foreground text-sm font-mono border border-border/50 p-4 rounded-xl">
                        {t('terminal.dashboardPlaceholder')}
                    </div>
                </div>
            );
            case 'workflows': return <Suspense fallback={<LoadingState size="md" />}><WorkflowsPage /></Suspense>;
            default: return null;
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={currentView}
                className={cn("h-full overflow-hidden", currentView === 'memory' && "h-[calc(100vh-64px)]")}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: pagePreset.duration, ease: pagePreset.ease }}
            >
                <ErrorBoundary resetKeys={[currentView]}>
                    <Suspense fallback={renderViewSkeleton(currentView)}>
                        {renderView()}
                    </Suspense>
                </ErrorBoundary>
            </motion.div>
            {isListening && (
                <div onClick={() => stopListening()} className="absolute top-4 right-4 z-[9999] cursor-pointer bg-destructive/70 text-destructive-foreground px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-xxs">{t('audioChat.listeningLabel')}</span>
                </div>
            )}
        </AnimatePresence>
    );
};

