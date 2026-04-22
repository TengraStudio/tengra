/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChatErrorState } from '@renderer/features/chat/components/ChatErrorState';
import { ChatHeader } from '@renderer/features/chat/components/ChatHeader';
import { ChatInput } from '@renderer/features/chat/components/ChatInput';
import { ExportModal } from '@renderer/features/chat/components/ExportModal';
import { MessageList } from '@renderer/features/chat/components/MessageList';
import { MultiModelCollaboration } from '@renderer/features/chat/components/MultiModelCollaboration';
import { WelcomeScreen } from '@renderer/features/chat/components/WelcomeScreen';
import { ChatTemplate } from '@renderer/features/chat/types';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { ChatFilePreviewPanel, ChatPreviewTab, createLoadingDiffTab, createLoadingFileTab } from '@/features/chat/components/ChatFilePreviewPanel';
import { WORKSPACE_NAVIGATE_EVENT, WorkspaceNavigationAction } from '@/features/workspace/utils/workspace-navigation';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

/* Batch-02: Extracted Long Classes */
const C_CHATVIEW_1 = "absolute bottom-28 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-border/50 bg-background text-foreground transition-colors hover:bg-accent";


interface ChatViewProps {
    templates: ChatTemplate[];
    showScrollButton?: boolean;
    setShowScrollButton?: (show: boolean) => void;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onScrollToBottom: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    showFileMenu: boolean;
    setShowFileMenu: (show: boolean) => void;
}

export const ChatView: React.FC<ChatViewProps> = React.memo(({
    templates,
    showScrollButton,
    setShowScrollButton,
    messagesEndRef: _messagesEndRef, // Kept for prop compatibility, but unused for scrolling now
    onScrollToBottom: _onScrollToBottom, // Kept for prop compatibility, but we use internal ref
    fileInputRef,
    textareaRef,
    showFileMenu,
    setShowFileMenu
}) => {
    // Context Consumption
    const {
        displayMessages, searchTerm, setSearchTerm, setInput,
        streamingReasoning, streamingSpeed, isLoading,
        speakingMessageId, handleSpeak, handleStopSpeak, regenerateMessage,
        chatError, clearChatError, chats, currentChatId, handleSend, clearMessages, contextTokens, contextWindow
    } = useChat();

    const { language } = useAuth();
    const { selectedProvider, selectedModel, selectedModels, models } = useModel();
    const { t } = useTranslation(language);

    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const [showExportModal, setShowExportModal] = React.useState(false);
    const [showCollaborationPanel, setShowCollaborationPanel] = React.useState(false);

    const [previewTabs, setPreviewTabs] = React.useState<ChatPreviewTab[]>([]);
    const [activePreviewTabId, setActivePreviewTabId] = React.useState<string>('');
    const activeChat = React.useMemo(() => chats.find(c => c.id === currentChatId), [chats, currentChatId]);
    const availableCollaborationModels = React.useMemo(
        () => models
            .filter((model): model is typeof model & { id: string; provider: string } =>
                typeof model.id === 'string' && model.id.length > 0
                && typeof model.provider === 'string' && model.provider.length > 0)
            .map(model => ({
                provider: model.provider,
                model: model.id,
                label: model.name || model.id,
            })),
        [models]
    );
    const isMultiModelSelection = selectedModels.length > 1;

    const handleErrorRetry = useCallback(() => {
        clearChatError();
        const lastUserMsg = [...displayMessages].reverse().find(m => m.role === 'user');
        if (lastUserMsg && typeof lastUserMsg.content === 'string') {
            void handleSend(lastUserMsg.content);
        }
    }, [clearChatError, displayMessages, handleSend]);

    const handleSwitchModel = useCallback(() => {
        window.dispatchEvent(new CustomEvent('tengra:open-model-selector'));
    }, []);

    // ... existing scroll handler ...
    const handleScrollToBottom = () => {
        virtuosoRef.current?.scrollToIndex({
            index: displayMessages.length - 1,
            align: 'end',
            behavior: 'smooth'
        });
    };

    React.useEffect(() => {
        const openFile = async (path: string, readOnly?: boolean) => {
            const tabId = `file:${path}`;
            setPreviewTabs(prev => {
                const existing = prev.find(t => t.id === tabId);
                if (existing) {
                    return prev;
                }
                return [...prev, createLoadingFileTab(path, Boolean(readOnly))];
            });
            setActivePreviewTabId(tabId);

            const res = await window.electron.files.readFile(path);
            const content = (res.data ?? res.result ?? res.content ?? '') as string;
            setPreviewTabs(prev => prev.map(t => {
                if (t.id !== tabId || t.kind !== 'file') {
                    return t;
                }
                if (!res.success) {
                    return { ...t, loading: false, error: res.error || 'Failed to open file' };
                }
                return { ...t, loading: false, error: undefined, content };
            }));
        };

        const openDiff = async (path: string) => {
            const tabId = `diff:${path}`;
            setPreviewTabs(prev => {
                const existing = prev.find(t => t.id === tabId);
                if (existing) {
                    return prev;
                }
                return [...prev, createLoadingDiffTab(path)];
            });
            setActivePreviewTabId(tabId);

            const cwd = (() => {
                const parts = (path ?? '').split(/[\\/]/).filter(Boolean);
                if (parts.length <= 1) {
                    return '.';
                }
                const isWinDrive = /^[a-zA-Z]:$/.test(parts[0]);
                const dirParts = parts.slice(0, -1);
                if (isWinDrive) {
                    // Re-add the drive segment with trailing backslash.
                    return `${dirParts[0]}\\${dirParts.slice(1).join('\\')}`;
                }
                return path.includes('\\') ? dirParts.join('\\') : `/${dirParts.join('/')}`;
            })();

            const res = await window.electron.git.getFileDiff(cwd, path, false);
            setPreviewTabs(prev => prev.map(t => {
                if (t.id !== tabId || t.kind !== 'diff') {
                    return t;
                }
                if (!res.success) {
                    return { ...t, loading: false, error: res.error || 'Failed to load diff' };
                }
                return { ...t, loading: false, error: undefined, original: res.original, modified: res.modified };
            }));
        };

        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<WorkspaceNavigationAction>;
            const action = customEvent.detail;
            if (!action) {
                return;
            }
            if (action.type === 'open_file') {
                void openFile(action.path, action.readOnly);
            } else if (action.type === 'open_diff') {
                void openDiff(action.path);
            }
        };

        window.addEventListener(WORKSPACE_NAVIGATE_EVENT, handler);
        return () => window.removeEventListener(WORKSPACE_NAVIGATE_EVENT, handler);
    }, []);

    return (
        <div data-testid="chat-view" className="h-full w-full flex overflow-hidden">
            <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
                {displayMessages.length !== 0 && (
                    <ChatHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        onClearMessages={() => void clearMessages()}
                        contextTokens={contextTokens}
                        contextWindow={contextWindow}
                        t={t}
                        onExport={() => setShowExportModal(true)}
                    />
                )}

                <div className="flex-1 w-full p-0 flex flex-col relative overflow-hidden">
                    {displayMessages.length === 0 ? (
                        <div className="flex-1 overflow-y-auto">
                            <WelcomeScreen
                                t={t}
                                templates={templates}
                                onSelectTemplate={(prompt) => setInput(prompt)}
                            />
                        </div>
                    ) : (
                        <MessageList
                            messages={displayMessages}
                            streamingReasoning={streamingReasoning}
                            streamingSpeed={streamingSpeed ?? null}
                            isLoading={isLoading}
                            language={language}
                            selectedProvider={selectedProvider}
                            selectedModel={selectedModel}
                            onSpeak={(text, id) => handleSpeak(id, text)}
                            onStopSpeak={handleStopSpeak}
                            speakingMessageId={speakingMessageId}
                            onRegenerate={regenerateMessage}
                            onAtBottomStateChange={(atBottom) => {
                                if (setShowScrollButton) {
                                    setShowScrollButton(!atBottom);
                                }
                            }}
                            virtuosoRef={virtuosoRef}
                        />
                    )}

                    {chatError && !isLoading && (
                        <ChatErrorState
                            error={chatError}
                            onRetry={handleErrorRetry}
                            onSwitchModel={handleSwitchModel}
                            onDismiss={clearChatError}
                        />
                    )}
                </div>

                <AnimatePresence>
                    {showScrollButton && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleScrollToBottom}
                            className={C_CHATVIEW_1}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {isMultiModelSelection && (
                    <div className="border-t border-border/40 bg-muted/10 px-3 py-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCollaborationPanel(previous => !previous)}
                            className="w-full justify-between"
                        >
                            <span>{t('chat.collaboration.title')}</span>
                            <span className="typo-caption text-muted-foreground">
                                {showCollaborationPanel ? t('common.hide') : t('common.show')}
                            </span>
                        </Button>
                    </div>
                )}

                {isMultiModelSelection && showCollaborationPanel && (
                    <div className="max-h-96 overflow-y-auto border-t border-border/40 bg-background p-3">
                        <MultiModelCollaboration
                            messages={displayMessages}
                            availableModels={availableCollaborationModels}
                        />
                    </div>
                )}

                <ChatInput
                    fileInputRef={fileInputRef}
                    textareaRef={textareaRef}
                    showFileMenu={showFileMenu}
                    setShowFileMenu={setShowFileMenu}
                />

                {activeChat && (
                    <ExportModal
                        isOpen={showExportModal}
                        onClose={() => setShowExportModal(false)}
                        chat={activeChat}
                        messages={displayMessages}
                    />
                )}
            </div>

            {previewTabs.length > 0 && activePreviewTabId && (
                <ChatFilePreviewPanel
                    tabs={previewTabs}
                    activeTabId={activePreviewTabId}
                    onClose={() => {
                        setPreviewTabs([]);
                        setActivePreviewTabId('');
                    }}
                    onSelectTab={(id) => setActivePreviewTabId(id)}
                    onCloseTab={(id) => {
                        setPreviewTabs(prev => {
                            const remaining = prev.filter(t => t.id !== id);
                            setActivePreviewTabId(current => {
                                if (current && current !== id) {
                                    return current;
                                }
                                return remaining[remaining.length - 1]?.id ?? '';
                            });
                            return remaining;
                        });
                    }}
                />
            )}
        </div>
    );
});

ChatView.displayName = 'ChatView';
