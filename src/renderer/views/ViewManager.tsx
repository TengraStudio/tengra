import { useAuth } from '@renderer/context/AuthContext';
import { useChat } from '@renderer/context/ChatContext';
import { useModel } from '@renderer/context/ModelContext';
import { useProject } from '@renderer/context/ProjectContext';
import { ChatTemplate } from '@renderer/features/chat/types';
import { GroupedModels } from '@renderer/features/models/utils/model-fetcher';
import React, { lazy, Suspense, useEffect } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { Language } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

// Lazy load feature modules

const DockerDashboard = lazy(() => import('@/features/mcp/DockerDashboard').then(m => ({ default: m.DockerDashboard })));
const MemoryInspector = lazy(() => import('@/features/memory/components/MemoryInspector').then(m => ({ default: m.MemoryInspector })));
const IdeasPage = lazy(() => import('@/features/ideas/IdeasPage').then(m => ({ default: m.IdeasPage })));
const ProjectAgentView = lazy(() => import('@/features/project-agent/ProjectAgentView').then(m => ({ default: m.ProjectAgentView })));

import { AppView } from '@renderer/hooks/useAppState';

const ChatViewWrapper = lazy(() => import('./ViewManager/ChatViewWrapper').then(m => ({ default: m.ChatViewWrapper })));
const ProjectsView = lazy(() => import('./ViewManager/ProjectsView').then(m => ({ default: m.ProjectsView })));
const SettingsView = lazy(() => import('./ViewManager/SettingsView').then(m => ({ default: m.SettingsView })));

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
}

/**
 * Chat component wrapper to isolate hook consumption
 */
const ChatSection: React.FC<Omit<ViewManagerProps, 'currentView' | 'onNavigateToProject'>> = (props) => (
    <ChatViewWrapper {...props} />
);

/**
 * Projects component wrapper to isolate hook consumption
 */
const ProjectsSection: React.FC<{ language: Language }> = ({ language }) => {
    const {
        projects, selectedProject, setSelectedProject,
        terminalTabs, activeTerminalId, setTerminalTabs, setActiveTerminalId
    } = useProject();
    const {
        selectedProvider, selectedModel, setSelectedProvider, setSelectedModel,
        persistLastSelection, groupedModels
    } = useModel();
    const { quotas, codexUsage, appSettings } = useAuth();
    const { isLoading, handleSend: sendMessage, setInput, displayMessages } = useChat();

    return (
        <ProjectsView
            projects={projects}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            language={language}
            terminalTabs={terminalTabs}
            activeTerminalId={activeTerminalId}
            setTerminalTabs={setTerminalTabs}
            setActiveTabId={setActiveTerminalId}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelectModel={(p, m) => {
                setSelectedProvider(p);
                setSelectedModel(m);
                void persistLastSelection(p, m);
            }}
            groupedModels={groupedModels}
            quotas={quotas}
            codexUsage={codexUsage}
            appSettings={appSettings}
            onSendMessage={(text) => {
                setInput(text ?? '');
                void sendMessage(text ?? '');
            }}
            displayMessages={displayMessages}
            isLoading={isLoading}
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
            loadModels={() => void loadModels()}
            settingsCategory={settingsCategory}
            groupedModels={groupedModels}
        />
    );
};

export const ViewManager: React.FC<ViewManagerProps> = (props) => {
    const { currentView, onNavigateToProject } = props;
    const { language } = useAuth();
    const { stopListening, isListening } = useChat();
    const { setIsModelMenuOpen } = useModel();
    const { handleOpenTerminal } = useProject();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'm') { setIsModelMenuOpen(prev => !prev); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setIsModelMenuOpen]);

    const renderView = () => {
        switch (currentView) {
            case 'chat': return <ChatSection {...props} />;
            case 'projects': return <ProjectsSection language={language} />;

            case 'settings': return <SettingsSection />;
            case 'mcp': return (
                <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
                    <Suspense fallback={<LoadingState size="md" />}><DockerDashboard onOpenTerminal={handleOpenTerminal} language={language} /></Suspense>
                </div>
            );
            case 'memory': return <Suspense fallback={<LoadingState size="md" />}><MemoryInspector /></Suspense>;
            case 'ideas': return <Suspense fallback={<LoadingState size="md" />}><IdeasPage language={language} onNavigateToProject={(id) => void onNavigateToProject?.(id)} /></Suspense>;
            case 'project-agent': return <Suspense fallback={<LoadingState size="md" />}><ProjectAgentView /></Suspense>;
            case 'docker': return (
                <div className="h-full p-6 overflow-y-auto bg-tech-grid bg-tech-grid-sm">
                    <Suspense fallback={<LoadingState size="md" />}><DockerDashboard onOpenTerminal={handleOpenTerminal} language={language} /></Suspense>
                </div>
            );
            case 'terminal': return (
                <div className="h-full p-6 flex flex-col items-center justify-center bg-tech-grid opacity-50">
                    <div className="text-muted-foreground text-sm font-mono border border-border/50 p-4 rounded-xl">
                        [ Terminal Dashboard Placeholder ]
                    </div>
                </div>
            );
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
                transition={{ duration: 0.15, ease: "easeOut" }}
            >
                <Suspense fallback={<LoadingState size="md" />}>{renderView()}</Suspense>
            </motion.div>
            {isListening && (
                <div onClick={() => stopListening()} className="absolute top-4 right-4 z-[9999] cursor-pointer bg-destructive/70 text-destructive-foreground px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[10px]">Listening</span>
                </div>
            )}
        </AnimatePresence>
    );
};
