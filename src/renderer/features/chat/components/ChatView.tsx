import { ChatErrorState } from '@renderer/features/chat/components/ChatErrorState';
import { ChatHeader } from '@renderer/features/chat/components/ChatHeader';
import { ChatInput } from '@renderer/features/chat/components/ChatInput';
import { ExportModal } from '@renderer/features/chat/components/ExportModal';
import { MessageList } from '@renderer/features/chat/components/MessageList';
import { WelcomeScreen } from '@renderer/features/chat/components/WelcomeScreen';
import { ChatTemplate } from '@renderer/features/chat/types';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';

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
    const { selectedProvider, selectedModel } = useModel();
    const { t } = useTranslation(language);

    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const [showExportModal, setShowExportModal] = React.useState(false);
    const activeChat = React.useMemo(() => chats.find(c => c.id === currentChatId), [chats, currentChatId]);

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

    return (
        <div
            data-testid="chat-view"
            className="h-full flex flex-col overflow-hidden"
        >
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
                        className="absolute bottom-32 right-8 p-3 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-110 active:scale-95 transition-all z-20"
                    >
                        <ChevronDown className="w-5 h-5" />
                    </motion.button>
                )}
            </AnimatePresence>

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
    );
});

ChatView.displayName = 'ChatView';
