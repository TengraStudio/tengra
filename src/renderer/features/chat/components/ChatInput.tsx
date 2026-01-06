import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, X, FileText, ImageIcon, Volume2, Brain, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashMenu } from './SlashMenu';
import { ModelSelector } from '@/features/models/components/ModelSelector';
import { Attachment } from '@/types';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    attachments: Attachment[];
    removeAttachment: (index: number) => void;
    isLoading: boolean;
    sendMessage: () => void;
    stopGeneration: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    processFile: (file: File) => void;
    showFileMenu: boolean;
    setShowFileMenu: (show: boolean) => void;
    selectedProvider: string;
    selectedModel: string;
    onSelectModel: (p: string, m: string) => void;
    appSettings: any;
    groupedModels: any;
    quotas: any;
    codexUsage: any;
    setIsModelMenuOpen: (open: boolean) => void;
    contextTokens: number;
    t: (key: string) => string;
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    autoReadEnabled: boolean;
    setAutoReadEnabled: (enabled: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * ChatInput Component
 * 
 * The main input area for the chat, featuring:
 * - Textarea with auto-resize and slash commands
 * - File attachments (images, docs) with preview
 * - Model selection and provider switching
 * - Audio controls (TTS auto-read, voice input)
 * - Send/Stop buttons
 */
export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    attachments,
    removeAttachment,
    isLoading,
    sendMessage,
    stopGeneration,
    fileInputRef,
    textareaRef,
    processFile,
    showFileMenu,
    setShowFileMenu,
    selectedProvider,
    selectedModel,
    onSelectModel,
    appSettings,
    groupedModels,
    quotas,
    codexUsage,
    setIsModelMenuOpen,
    contextTokens,
    allCommands,
    t,
    isListening,
    startListening,
    stopListening,
    autoReadEnabled,
    setAutoReadEnabled,
    handleKeyDown,
    handlePaste
}) => {
    return (
        <div className="p-4 sm:p-8 pt-2 max-w-4xl mx-auto w-full relative shrink-0">
            <AnimatePresence>
                {attachments.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex flex-wrap gap-2 px-1 mb-3"
                    >
                        {attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-sm group/att">
                                {att.type === 'image' ? (
                                    <div className="w-4 h-4 rounded-sm overflow-hidden border border-white/10">
                                        <img src={att.preview} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                )}
                                <span className="text-[11px] font-bold text-muted-foreground/80 max-w-[120px] truncate">{att.file.name}</span>
                                <button onClick={() => removeAttachment(i)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative flex items-end rounded-2xl bg-muted/20 border border-border transition-all duration-300 focus-within:bg-muted/40 focus-within:border-primary/30 shadow-sm group/input">
                <SlashMenu
                    isOpen={input.startsWith('/')}
                    onClose={() => { }}
                    query={input.slice(1)}
                    onSelect={(cmd: any) => { cmd.action(); setInput('') }}
                    commands={allCommands}
                />
                <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach(processFile); e.target.value = '' }}
                />

                <div className="relative flex items-center p-2 pl-3 pb-3 gap-2">
                    <ModelSelector
                        selectedProvider={(selectedProvider as any)}
                        selectedModel={selectedModel}
                        onSelect={onSelectModel}
                        settings={appSettings}
                        groupedModels={groupedModels || undefined}
                        quotas={quotas}
                        codexUsage={codexUsage}
                        onOpenChange={setIsModelMenuOpen}
                        contextTokens={contextTokens}
                    />
                    <button
                        onClick={() => setShowFileMenu(!showFileMenu)}
                        className="text-muted-foreground hover:text-primary transition-all p-2 hover:bg-primary/10 rounded-xl"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                        {showFileMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute bottom-full left-4 mb-4 bg-card border border-border rounded-2xl p-2 shadow-2xl z-50 min-w-[180px]"
                            >
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                                    onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}
                                >
                                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                                    {t('attachments.image')}
                                </button>
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                                    onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}
                                >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                    {t('attachments.document')}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <textarea
                    ref={textareaRef}
                    className="flex-1 bg-transparent border-none py-5 pl-0 pr-4 min-h-[60px] max-h-[300px] resize-none focus:ring-0 text-base placeholder:text-muted-foreground/30 outline-none text-foreground font-medium"
                    placeholder={t('chat.placeholder')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    rows={1}
                />

                <div className="p-3 pr-4 flex items-end gap-3">
                    <button
                        onClick={() => {/* handled by shortcut/context later */ }}
                        className="h-10 w-10 text-muted-foreground/40 hover:text-foreground hover:bg-white/5 transition-all"
                    >
                        <Volume2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setAutoReadEnabled(!autoReadEnabled)}
                        className={cn("h-10 w-10 transition-all", autoReadEnabled ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-foreground")}
                    >
                        <Brain className={cn("w-5 h-5", autoReadEnabled && "animate-pulse")} />
                    </button>
                    <button
                        onClick={isListening ? stopListening : startListening}
                        className={cn("h-10 w-10 rounded-xl transition-all", isListening ? "bg-red-500 animate-pulse" : "bg-transparent text-muted-foreground")}
                    >
                        {isListening ? <div className="w-3 h-3 bg-white" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={sendMessage}
                        disabled={!isLoading && !input.trim()}
                        className={cn("h-10 w-10 rounded-xl transition-all", !isLoading && !input.trim() ? "bg-white/5 text-muted-foreground/30" : "bg-primary text-primary-foreground")}
                    >
                        {isLoading ? <div className="w-3 h-3 bg-white" /> : <Send className="w-5 h-5 ml-0.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
