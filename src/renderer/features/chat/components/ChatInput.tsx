import {
    File as FileIcon,
    FileCode,
    FileText,
    Image as ImageIcon,
    Mic,
    MicOff,
    Paperclip,
    Send,
    Sparkles,
    Square,
    X,
} from 'lucide-react';
import React, { memo, useEffect, useRef } from 'react';

import { ModelSelector } from '@/features/models/components/ModelSelector';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Attachment } from '@/types';

import { useChatInputController } from '../hooks/useChatInputController';

interface ChatInputProps {
    fileInputRef?: React.RefObject<HTMLInputElement>;
    textareaRef?: React.RefObject<HTMLTextAreaElement>;
    showFileMenu?: boolean;
    setShowFileMenu?: (show: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = memo(
    ({ fileInputRef: externalFileInputRef, textareaRef: externalTextareaRef }) => {
        const ctrl = useChatInputController();

        const localFileInputRef = useRef<HTMLInputElement>(null);
        const localTextareaRef = useRef<HTMLTextAreaElement>(null);
        const fileInputRef = externalFileInputRef ?? localFileInputRef;
        const textareaRef = externalTextareaRef ?? localTextareaRef;

        useEffect(() => {
            const area = textareaRef.current;
            if (!area) {
                return;
            }

            // Auto-resize textarea
            area.style.height = 'auto';
            area.style.height = `${Math.min(area.scrollHeight, 200)}px`;

            // ResizeObserver for more robust resizing
            const resizeObserver = new ResizeObserver(() => {
                area.style.height = 'auto';
                area.style.height = `${Math.min(area.scrollHeight, 200)}px`;
            });

            resizeObserver.observe(area);

            // Cleanup
            return () => {
                resizeObserver.disconnect();
            };
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
                if (ctrl.handleCommandNavigation(e)) {
                    return;
                }
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
                    'p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm relative z-30',
                    ctrl.isDragging && 'ring-2 ring-primary/50 border-primary/50'
                )}
                onDragOver={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    ctrl.setIsDragging(true);
                }}
                onDragLeave={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    ctrl.setIsDragging(false);
                }}
                onDrop={ctrl.onDrop}
            >
                <AttachmentList
                    attachments={ctrl.attachments}
                    onRemove={ctrl.removeAttachment}
                    t={ctrl.t}
                />

                <PromptCommandMenu
                    show={ctrl.showCommandMenu && ctrl.filteredPrompts.length > 0}
                    prompts={ctrl.filteredPrompts}
                    selectedIndex={ctrl.selectedIndex}
                    onSelect={prompt => {
                        const words = ctrl.input.split(' ');
                        words.pop();
                        const newText =
                            words.join(' ') + (words.length > 0 ? ' ' : '') + prompt.content;
                        ctrl.setInput(newText);
                        ctrl.setShowCommandMenu(false);
                    }}
                    t={ctrl.t}
                />

                <div className="relative flex items-end gap-2 bg-muted/30 border border-border/50 rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
                    <div className="flex items-center justify-center gap-1.5 px-1 py-0.5">
                        <div className="relative">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
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
                                'p-2 rounded-lg transition-all',
                                ctrl.isListening
                                    ? 'bg-destructive/20 text-destructive animate-pulse'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                            title={
                                ctrl.isListening
                                    ? ctrl.t('input.stopListening')
                                    : ctrl.t('input.startListening')
                            }
                            aria-label={
                                ctrl.isListening
                                    ? ctrl.t('input.stopListening')
                                    : ctrl.t('input.startListening')
                            }
                            aria-pressed={ctrl.isListening}
                        >
                            {ctrl.isListening ? (
                                <MicOff size={20} aria-hidden="true" />
                            ) : (
                                <Mic size={20} aria-hidden="true" />
                            )}
                        </button>

                        <div className="h-8 w-px bg-border/50 mx-1" />

                        <div className="h-8 w-px bg-border/50 mx-1" />
                        <ModelSelectorWrapper ctrl={ctrl} />
                    </div>

                    <textarea
                        data-testid="chat-textarea"
                        ref={textareaRef}
                        value={ctrl.input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={ctrl.t('input.placeholder.default')}
                        className="flex-1 bg-transparent border-none focus:border-none focus:ring-offset-0 ring-offset-0 ring-0 focus:ring-0 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none py-2.5 max-h-[200px]"
                        rows={1}
                        aria-label={ctrl.t('input.placeholder.default')}
                        aria-describedby="chat-input-hint"
                    />

                    <EnhanceButton ctrl={ctrl} />
                    <SendButton ctrl={ctrl} />
                </div>
            </div>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.fileInputRef === nextProps.fileInputRef &&
            prevProps.textareaRef === nextProps.textareaRef
        );
    }
);

ChatInput.displayName = 'ChatInput';

const AttachmentList: React.FC<{
    attachments: Attachment[];
    onRemove: (i: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}> = ({ attachments, onRemove, t }) => {
    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) {
            return <ImageIcon size={14} />;
        }
        if (type.includes('text') || type.includes('json') || type.includes('md')) {
            return <FileText size={14} />;
        }
        if (type.includes('code') || type.includes('javascript') || type.includes('python')) {
            return <FileCode size={14} />;
        }
        return <FileIcon size={14} />;
    };

    return (
        <AnimatePresence>
            {attachments.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex flex-wrap gap-2 mb-3 px-2"
                >
                    {attachments.map((att, i) => (
                        <div
                            key={i}
                            className="group relative flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-muted-foreground pr-8"
                        >
                            <span
                                className={cn(
                                    'p-1.5 rounded-md',
                                    att.type.startsWith('image/')
                                        ? 'bg-primary/20 text-primary'
                                        : 'bg-accent/20 text-accent-foreground'
                                )}
                            >
                                {getFileIcon(att.type)}
                            </span>
                            <span className="truncate max-w-[150px]">{att.name}</span>
                            <span className="text-neutral text-xxs">
                                ({(att.size / 1024).toFixed(1)} {t('common.kb')})
                            </span>
                            <button
                                onClick={() => onRemove(i)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={t('input.removeAttachment', { name: att.name })}
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
    show: boolean;
    prompts: Array<{ id: string; title: string; content: string }>;
    selectedIndex: number;
    onSelect: (prompt: { id: string; title: string; content: string }) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}> = ({ show, prompts, selectedIndex, onSelect, t }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border/50 rounded-lg shadow-xl overflow-hidden z-50"
                role="listbox"
                aria-label={t('input.promptSuggestions')}
            >
                <div
                    className="text-xxs uppercase font-bold text-muted-foreground px-3 py-1.5 bg-muted/30"
                    role="heading"
                    aria-level={3}
                >
                    {t('input.prompts')}
                </div>
                {prompts.map((prompt, i) => (
                    <button
                        key={prompt.id}
                        onClick={() => onSelect(prompt)}
                        className={cn(
                            'w-full text-left px-3 py-2 text-xs transition-colors block',
                            i === selectedIndex
                                ? 'bg-primary/20 text-primary'
                                : 'hover:bg-accent/50 text-foreground'
                        )}
                        aria-label={t('input.usePrompt', { title: prompt.title })}
                        aria-selected={i === selectedIndex}
                        role="option"
                    >
                        <div className="font-medium">{prompt.title}</div>
                        <div className="text-xxs text-muted-foreground truncate">
                            {prompt.content}
                        </div>
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
            selectedProvider={ctrl.selectedProvider}
            selectedModel={ctrl.selectedModel}
            selectedModels={ctrl.selectedModels}
            onSelect={ctrl.handleSelectModel}
            onRemoveModel={ctrl.removeSelectedModel}
            settings={ctrl.appSettings ?? undefined}
            groupedModels={ctrl.groupedModels ?? undefined}
            quotas={ctrl.quotas}
            codexUsage={ctrl.codexUsage}
            claudeQuota={ctrl.claudeQuota}
            onOpenChange={ctrl.setIsModelMenuOpen}
            contextTokens={ctrl.contextTokens}
            language={ctrl.language}
            toggleFavorite={ctrl.toggleFavorite}
            isFavorite={ctrl.isFavorite}
            thinkingLevel={ctrl.getModelReasoningLevel?.(ctrl.selectedModel)}
            onThinkingLevelChange={level =>
                ctrl.setModelReasoningLevel?.(ctrl.selectedModel, level)
            }
        />
    </div>
);

const EnhanceButton: React.FC<{ ctrl: ControllerType }> = ({ ctrl }) => {
    const isEnhancable = ctrl.input.trim() !== '' && !ctrl.isLoading;
    const isEnhancing = ctrl.isEnhancing;
    const btnClass = cn(
        'p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5',
        isEnhancing
            ? 'bg-warning/20 text-warning animate-pulse'
            : isEnhancable
              ? 'bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning-light'
              : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
    );
    return (
        <button
            onClick={() => {
                void ctrl.handleEnhancePrompt();
            }}
            disabled={!isEnhancable || isEnhancing}
            className={btnClass}
            title={ctrl.t('input.enhancePrompt')}
            aria-label={ctrl.t('input.enhancePrompt')}
        >
            <Sparkles size={18} className={cn(isEnhancing && 'animate-spin')} aria-hidden="true" />
        </button>
    );
};

const SendButton: React.FC<{ ctrl: ControllerType }> = ({ ctrl }) => {
    const hasContent = ctrl.input.trim() !== '' || ctrl.attachments.length > 0;
    const isLoading = ctrl.isLoading;
    const btnClass = cn(
        'p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5',
        isLoading
            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
            : hasContent
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity'
              : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
    );
    return (
        <button
            onClick={
                isLoading
                    ? ctrl.stopGeneration
                    : () => {
                          void ctrl.sendMessage();
                      }
            }
            disabled={!isLoading && !hasContent}
            className={btnClass}
            aria-label={isLoading ? ctrl.t('common.stop') : ctrl.t('common.send')}
        >
            <SendIcon isLoading={isLoading} hasContent={hasContent} />
        </button>
    );
};

const SendIcon: React.FC<{ isLoading: boolean; hasContent: boolean }> = ({
    isLoading,
    hasContent,
}) => {
    const Icon = isLoading ? Square : Send;
    const colorFill = isLoading ? 'currentColor' : 'none';
    const iClass = cn(isLoading && 'animate-pulse', !isLoading && hasContent && 'ml-0.5');
    return <Icon size={18} fill={colorFill} className={iClass} aria-hidden="true" />;
};
