import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';
import { Message, Attachment } from '@/types';
import { Language } from '@/i18n';

interface ChatViewProps {
    messages: Message[];
    displayMessages: Message[];
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    t: (key: string) => string;
    templates: any[];
    setInput: (value: string) => void;
    isLoading: boolean;
    streamingContent: string;
    streamingReasoning?: string;
    streamingSpeed: number | null;
    language: Language;
    selectedProvider: string;
    selectedModel: string;
    onSpeak: (text: string, id: string) => void;
    onStopSpeak: () => void;
    speakingMessageId: string | null;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onScrollToBottom: () => void;
    input: string;
    attachments: Attachment[];
    removeAttachment: (index: number) => void;
    sendMessage: () => void;
    stopGeneration: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    processFile: (file: File) => void;
    showFileMenu: boolean;
    setShowFileMenu: (show: boolean) => void;
    onSelectModel: (p: string, m: string) => void;
    appSettings: any;
    groupedModels: any;
    quotas: any;
    codexUsage: any;
    setIsModelMenuOpen: (open: boolean) => void;
    contextTokens: number;
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    autoReadEnabled: boolean;
    setAutoReadEnabled: (enabled: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    showScrollButton?: boolean;
    setShowScrollButton?: (show: boolean) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
    messages: _messages,
    displayMessages,

    searchTerm,
    setSearchTerm,
    t,
    templates,
    setInput,
    isLoading,
    streamingContent,
    streamingReasoning,
    streamingSpeed,
    language,
    selectedProvider,
    selectedModel,
    onSpeak,
    onStopSpeak,
    speakingMessageId,
    messagesEndRef,
    onScrollToBottom,
    input,
    attachments,
    removeAttachment,
    sendMessage,
    stopGeneration,
    fileInputRef,
    textareaRef,
    processFile,
    showFileMenu,
    setShowFileMenu,
    onSelectModel,
    appSettings,
    groupedModels,
    quotas,
    codexUsage,
    setIsModelMenuOpen,
    contextTokens,
    isListening,
    startListening,
    stopListening,
    autoReadEnabled,
    setAutoReadEnabled,
    handleKeyDown,
    handlePaste,
    showScrollButton,
    setShowScrollButton
}) => {
    return (
        <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col overflow-hidden"
        >
            <ChatHeader
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />

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
                        streamingContent={streamingContent}
                        streamingReasoning={streamingReasoning}
                        streamingSpeed={streamingSpeed}
                        isLoading={isLoading}
                        language={language}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSpeak={onSpeak}
                        onStopSpeak={onStopSpeak}
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
                input={input}
                setInput={setInput}
                attachments={attachments}
                removeAttachment={removeAttachment}
                isLoading={isLoading}
                sendMessage={sendMessage}
                stopGeneration={stopGeneration}
                fileInputRef={fileInputRef}
                textareaRef={textareaRef}
                processFile={processFile}
                showFileMenu={showFileMenu}
                setShowFileMenu={setShowFileMenu}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
                appSettings={appSettings}
                groupedModels={groupedModels}
                quotas={quotas}
                codexUsage={codexUsage}
                setIsModelMenuOpen={setIsModelMenuOpen}
                contextTokens={contextTokens}
                t={t}
                isListening={isListening}
                startListening={startListening}
                stopListening={stopListening}
                autoReadEnabled={autoReadEnabled}
                setAutoReadEnabled={setAutoReadEnabled}
                handleKeyDown={handleKeyDown}
                handlePaste={handlePaste}
            />
        </motion.div>
    );
};
