import { Mic, MicOff, Paperclip, Send, Sparkles, Square, X } from 'lucide-react'
import { File as FileIcon, FileCode, FileText, Image as ImageIcon } from 'lucide-react'
import React, { memo, useEffect, useRef } from 'react'

import { ModelSelector } from '@/features/models/components/ModelSelector'
import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { Attachment } from '@/types'

import { useChatInputController } from '../hooks/useChatInputController'

interface ChatInputProps {
    fileInputRef?: React.RefObject<HTMLInputElement>
    textareaRef?: React.RefObject<HTMLTextAreaElement>
    showFileMenu?: boolean
    setShowFileMenu?: (show: boolean) => void
}

export const ChatInput: React.FC<ChatInputProps> = memo(({
    fileInputRef: externalFileInputRef,
    textareaRef: externalTextareaRef,
}) => {
    const ctrl = useChatInputController();

    const localFileInputRef = useRef<HTMLInputElement>(null);
    const localTextareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = externalFileInputRef ?? localFileInputRef;
    const textareaRef = externalTextareaRef ?? localTextareaRef;

    useEffect(() => {
        const area = textareaRef.current;
        if (area) {
            area.style.height = 'auto';
            area.style.height = `${Math.min(area.scrollHeight, 200)}px`;
        }
    }, [ctrl.input, textareaRef]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        ctrl.setInput(newValue);

        const lastWord = newValue.split(' ').pop() ?? '';
        if (lastWord.startsWith('/')) {
            ctrl.setShowCommandMenu(true);
            ctrl.setCommandQuery(lastWord.slice(1));
            ctrl.setSelectedIndex(0);
        } else {
            ctrl.setShowCommandMenu(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0) {
            if (ctrl.handleCommandNavigation(e)) { return; }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
            if (!ctrl.isLoading && hasContent) {
                void ctrl.sendMessage();
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const firstFile = e.target.files ? e.target.files[0] : null;
        if (firstFile) {
            void ctrl.processFile(firstFile);
            e.target.value = '';
        }
    };

    return (
        <div
            className={cn(
                "p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-sm relative z-30",
                ctrl.isDragging && "ring-2 ring-purple-500/50 border-purple-500/50"
            )}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.setIsDragging(false); }}
            onDrop={ctrl.onDrop}
        >
            <AttachmentList attachments={ctrl.attachments} onRemove={ctrl.removeAttachment} />

            <PromptCommandMenu
                show={ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0}
                prompts={ctrl.filteredPrompts}
                selectedIndex={ctrl.selectedIndex}
                onSelect={(prompt) => {
                    const words = ctrl.input.split(' ');
                    words.pop();
                    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + prompt.content;
                    ctrl.setInput(newText);
                    ctrl.setShowCommandMenu(false);
                }}
            />

            <div className="relative flex items-end gap-2 bg-zinc-900 border border-white/10 rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-purple-500/50 focus-within:border-purple-500/50 transition-all">
                <div className="flex items-center justify-center gap-1.5 px-1 py-0.5">
                    <div className="relative">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title={ctrl.t('input.attachFile')}
                            aria-label={ctrl.t('input.attachFile')}
                        >
                            <Paperclip size={20} aria-hidden="true" />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            multiple={false}
                        />
                    </div>

                    <button
                        onClick={ctrl.isListening ? ctrl.stopListening : ctrl.startListening}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            ctrl.isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                        title={ctrl.isListening ? ctrl.t('input.stopListening') : ctrl.t('input.startListening')}
                        aria-label={ctrl.isListening ? ctrl.t('input.stopListening') : ctrl.t('input.startListening')}
                        aria-pressed={ctrl.isListening}
                    >
                        {ctrl.isListening ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                    </button>

                    <div className="h-8 w-px bg-white/5 mx-1" />

                    <ModelSelectorWrapper ctrl={ctrl} />
                </div>

                <textarea
                    data-testid="chat-textarea"
                    ref={textareaRef}
                    value={ctrl.input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={ctrl.t('input.placeholder.default')}
                    className="flex-1 bg-transparent border-none focus:border-none focus:ring-offset-0 ring-offset-0 ring-0 focus:ring-0 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none py-2.5 max-h-[200px]"
                    rows={1}
                    aria-label={ctrl.t('input.placeholder.default')}
                    aria-describedby="chat-input-hint"
                />

                <EnhanceButton ctrl={ctrl} />
                <SendButton ctrl={ctrl} />
            </div>

            <div className="absolute bottom-1 right-4 text-[10px] text-zinc-700 pointer-events-none select-none">
                {ctrl.selectedProvider}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.fileInputRef === nextProps.fileInputRef &&
        prevProps.textareaRef === nextProps.textareaRef
    );
});

ChatInput.displayName = 'ChatInput';

const AttachmentList: React.FC<{ attachments: Attachment[], onRemove: (i: number) => void }> = ({ attachments, onRemove }) => {
    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) { return <ImageIcon size={14} />; }
        if (type.includes('text') || type.includes('json') || type.includes('md')) { return <FileText size={14} />; }
        if (type.includes('code') || type.includes('javascript') || type.includes('python')) { return <FileCode size={14} />; }
        return <FileIcon size={14} />;
    };

    return (
        <AnimatePresence>
            {attachments.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="flex flex-wrap gap-2 mb-3 px-2"
                >
                    {attachments.map((att, i) => (
                        <div key={i} className="group relative flex items-center gap-2 bg-zinc-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 pr-8">
                            <span className={cn("p-1.5 rounded-md", att.type.startsWith('image/') ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400")}>
                                {getFileIcon(att.type)}
                            </span>
                            <span className="truncate max-w-[150px]">{att.name}</span>
                            <span className="text-zinc-600 text-[10px]">({(att.size / 1024).toFixed(1)} KB)</span>
                            <button
                                onClick={() => onRemove(i)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Remove ${att.name}`}
                            >
                                <X size={12} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const PromptCommandMenu: React.FC<{
    show: boolean; prompts: Array<{ id: string; title: string; content: string }>;
    selectedIndex: number; onSelect: (prompt: { id: string; title: string; content: string }) => void;
}> = ({ show, prompts, selectedIndex, onSelect }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                role="listbox" aria-label="Prompt suggestions"
            >
                <div className="text-[10px] uppercase font-bold text-zinc-500 px-3 py-1.5 bg-black/20" role="heading" aria-level={3}>Prompts</div>
                {prompts.map((prompt, i) => (
                    <button
                        key={prompt.id} onClick={() => onSelect(prompt)}
                        className={cn("w-full text-left px-3 py-2 text-xs transition-colors block", i === selectedIndex ? "bg-purple-500/20 text-purple-200" : "hover:bg-white/5 text-zinc-300")}
                        aria-label={`Use prompt: ${prompt.title}`} aria-selected={i === selectedIndex} role="option"
                    >
                        <div className="font-medium">{prompt.title}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{prompt.content}</div>
                    </button>
                ))}
            </motion.div>
        )}
    </AnimatePresence>
);

type ControllerType = ReturnType<typeof useChatInputController>;

const ModelSelectorWrapper: React.FC<{ ctrl: ControllerType }> = ({ ctrl }) => (
    <div data-testid="model-selector">
        <ModelSelector
            selectedProvider={ctrl.selectedProvider} selectedModel={ctrl.selectedModel}
            selectedModels={ctrl.selectedModels} onSelect={ctrl.handleSelectModel}
            onRemoveModel={ctrl.removeSelectedModel} settings={ctrl.appSettings ?? undefined}
            groupedModels={ctrl.groupedModels ?? undefined} quotas={ctrl.quotas}
            codexUsage={ctrl.codexUsage} onOpenChange={ctrl.setIsModelMenuOpen}
            contextTokens={ctrl.contextTokens} language={ctrl.language}
            toggleFavorite={ctrl.toggleFavorite} isFavorite={ctrl.isFavorite}
        />
    </div>
);

const EnhanceButton: React.FC<{ ctrl: ControllerType }> = ({ ctrl }) => {
    const isEnhancable = ctrl.input.trim() !== '' && !ctrl.isLoading;
    const isEnhancing = ctrl.isEnhancing;
    const btnClass = cn(
        "p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5",
        isEnhancing ? "bg-amber-500/20 text-amber-400 animate-pulse" : (isEnhancable ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300" : "bg-white/5 text-zinc-600 cursor-not-allowed")
    );
    return (
        <button onClick={() => { void ctrl.handleEnhancePrompt(); }} disabled={!isEnhancable || isEnhancing} className={btnClass} title={ctrl.t('input.enhancePrompt')} aria-label={ctrl.t('input.enhancePrompt')}>
            <Sparkles size={18} className={cn(isEnhancing && "animate-spin")} aria-hidden="true" />
        </button>
    );
};

const SendButton: React.FC<{ ctrl: ControllerType }> = ({ ctrl }) => {
    const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
    const isLoading = ctrl.isLoading;
    const btnClass = cn(
        "p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5",
        isLoading ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : (hasContent ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20 hover:bg-purple-500" : "bg-white/5 text-zinc-600 cursor-not-allowed")
    );
    return (
        <button onClick={isLoading ? ctrl.stopGeneration : () => { void ctrl.sendMessage(); }} disabled={!isLoading && !hasContent} className={btnClass} aria-label={isLoading ? ctrl.t('common.stop') : ctrl.t('common.send')}>
            <SendIcon isLoading={isLoading} hasContent={hasContent} />
        </button>
    );
};

const SendIcon: React.FC<{ isLoading: boolean; hasContent: boolean }> = ({ isLoading, hasContent }) => {
    const Icon = isLoading ? Square : Send;
    const colorFill = isLoading ? "currentColor" : "none";
    const iClass = cn(isLoading && "animate-pulse", (!isLoading && hasContent) && "ml-0.5");
    return <Icon size={18} fill={colorFill} className={iClass} aria-hidden="true" />;
}
