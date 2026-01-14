import React from 'react';
import { motion, AnimatePresence } from '@/lib/framer-motion-compat';
import { ChevronDown } from 'lucide-react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';
import { ChatTemplate } from '../types';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';

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
    messagesEndRef,
    onScrollToBottom,
    fileInputRef,
    textareaRef,
    showFileMenu,
    setShowFileMenu
}) => {
    // Context Consumption
    const {
        displayMessages, searchTerm, setSearchTerm, setInput,
        streamingReasoning, streamingSpeed, isLoading,
        speakingMessageId, handleSpeak, handleStopSpeak
    } = useChat();

    const { language } = useAuth();
    const { selectedProvider, selectedModel } = useModel();
    const { t } = useTranslation(language || 'en');

    return (
        <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col overflow-hidden"
        >
            {displayMessages.length !== 0 && (
                <ChatHeader
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    t={t}
                />
            )}

            <div
                className="flex-1 overflow-y-auto w-full p-0 flex flex-col scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent relative"
                onScroll={(e) => {
                    const el = e.currentTarget;
                    const show = el.scrollHeight - el.scrollTop - el.clientHeight > 200;
                    if (setShowScrollButton) setShowScrollButton(show);
                }}
            >
                {displayMessages.length === 0 ? (
                    <WelcomeScreen
                        t={t}
                        templates={templates}
                        onSelectTemplate={(prompt) => setInput(prompt)}
                    />
                ) : (
                    <MessageList
                        messages={displayMessages}
                        streamingReasoning={streamingReasoning}
                        streamingSpeed={streamingSpeed}
                        isLoading={isLoading}
                        language={language || 'en'}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSpeak={(text, id) => handleSpeak(id, text)}
                        onStopSpeak={handleStopSpeak}
                        speakingMessageId={speakingMessageId}
                        messagesEndRef={messagesEndRef}
                    />
                )}
            </div>

            <AnimatePresence>
                {showScrollButton && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={onScrollToBottom}
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
        </motion.div>
    );
});
