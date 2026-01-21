import { File as FileIcon, FileCode, FileText, Image as ImageIcon, Mic, MicOff, Paperclip, Send, Square, X } from 'lucide-react'
import React, { useEffect, useRef } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useChat } from '@/context/ChatContext'
import { useModel } from '@/context/ModelContext'
import { ModelSelector } from '@/features/models/components/ModelSelector'
import { useTranslation } from '@/i18n'
import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'
import { Attachment } from '@/types'

interface ChatInputProps {
    fileInputRef?: React.RefObject<HTMLInputElement>
    textareaRef?: React.RefObject<HTMLTextAreaElement>
    showFileMenu?: boolean
    setShowFileMenu?: (show: boolean) => void
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
    fileInputRef: externalFileInputRef,
    textareaRef: externalTextareaRef,
    showFileMenu: _showFileMenu,
    setShowFileMenu: _setShowFileMenu
}) => {
    // Context Consumption
    const {
        input, setInput, attachments, removeAttachment, processFile,
        isLoading, handleSend: sendMessage, stopGeneration,
        prompts, isListening, startListening, stopListening,
        contextTokens
    } = useChat()

    const {
        selectedModel, selectedProvider, setSelectedModel, setSelectedProvider,
        groupedModels, setIsModelMenuOpen, toggleFavorite, isFavorite
    } = useModel()

    const {
        appSettings, quotas, codexUsage, language
    } = useAuth()

    const { t } = useTranslation(language || 'en')

    // Local refs if not provided from outside (though ViewManager usually provides them)
    const localFileInputRef = useRef<HTMLInputElement>(null)
    const localTextareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = externalFileInputRef || localFileInputRef
    const textareaRef = externalTextareaRef || localTextareaRef

    const [showCommandMenu, setShowCommandMenu] = React.useState(false)
    const [commandQuery, setCommandQuery] = React.useState('')
    const [selectedIndex, setSelectedIndex] = React.useState(0)
    const [isDragging, setIsDragging] = React.useState(false)

    const filteredPrompts = React.useMemo(() => {
        if (!prompts) { return [] }
        if (!commandQuery) { return prompts.slice(0, 5) }
        return prompts.filter(p => p.title.toLowerCase().includes(commandQuery.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(commandQuery.toLowerCase()))).slice(0, 5)
    }, [prompts, commandQuery])

    // Auto-resize textarea
    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        setInput(newValue)

        // Check for slash command
        const lastWord = newValue.split(' ').pop() ?? ''
        if (lastWord.startsWith('/')) {
            setShowCommandMenu(true)
            setCommandQuery(lastWord.slice(1))
            setSelectedIndex(0)
        } else {
            setShowCommandMenu(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showCommandMenu && filteredPrompts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % filteredPrompts.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + filteredPrompts.length) % filteredPrompts.length)
                return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                const selected = filteredPrompts[selectedIndex]
                if (selected) {
                    // Replace the slash command with content
                    const words = input.split(' ')
                    words.pop()
                    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + selected.content
                    setInput(newText)
                    setShowCommandMenu(false)
                }
                return
            }
            if (e.key === 'Escape') {
                setShowCommandMenu(false)
                return
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && (input.trim() || attachments.length > 0)) {
                void sendMessage()
            }
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0]
            if (file) {
                void processFile(file)
            }
            // Reset value so same file can be selected again
            e.target.value = ''
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            // Process the first file (can be extended to support multiple files)
            const file = files[0]
            if (file) {
                void processFile(file)
            }
        }
    }

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) { return <ImageIcon size={14} /> }
        if (type.includes('text') || type.includes('json') || type.includes('md')) { return <FileText size={14} /> }
        if (type.includes('code') || type.includes('javascript') || type.includes('python')) { return <FileCode size={14} /> }
        return <FileIcon size={14} />
    }

    return (
        <div
            className={cn(
                "p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-sm relative z-30",
                isDragging && "ring-2 ring-purple-500/50 border-purple-500/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Attachments Preview */}
            <AnimatePresence>
                {attachments.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex flex-wrap gap-2 mb-3 px-2"
                    >
                        {attachments.map((att: Attachment, i: number) => (
                            <div key={i} className="group relative flex items-center gap-2 bg-zinc-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 pr-8">
                                <span className={cn(
                                    "p-1.5 rounded-md",
                                    att.type.startsWith('image/') ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                                )}>
                                    {getFileIcon(att.type)}
                                </span>
                                <span className="truncate max-w-[150px]">{att.name}</span>
                                <span className="text-zinc-600 text-[10px]">({(att.size / 1024).toFixed(1)} KB)</span>

                                <button
                                    onClick={() => removeAttachment(i)}
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

            {/* Command Menu */}
            <AnimatePresence>
                {showCommandMenu && filteredPrompts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                        role="listbox"
                        aria-label="Prompt suggestions"
                    >
                        <div className="text-[10px] uppercase font-bold text-zinc-500 px-3 py-1.5 bg-black/20" role="heading" aria-level={3}>Prompts</div>
                        {filteredPrompts.map((prompt, i) => (
                            <button
                                key={prompt.id}
                                onClick={() => {
                                    const words = input.split(' ')
                                    words.pop()
                                    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + prompt.content
                                    setInput(newText)
                                    setShowCommandMenu(false)
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-xs transition-colors block",
                                    i === selectedIndex ? "bg-purple-500/20 text-purple-200" : "hover:bg-white/5 text-zinc-300"
                                )}
                                aria-label={`Use prompt: ${prompt.title}`}
                                aria-selected={i === selectedIndex}
                                role="option"
                            >
                                <div className="font-medium">{prompt.title}</div>
                                <div className="text-[10px] text-zinc-500 truncate">{prompt.content}</div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative flex items-end gap-2 bg-zinc-900 border border-white/10 rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-purple-500/50 focus-within:border-purple-500/50 transition-all">
                {/* File Upload Button */}
                <div className="flex items-center justify-center gap-1.5 px-1 py-0.5">
                    <div className="relative">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title={t('input.attachFile')}
                            aria-label={t('input.attachFile')}
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
                        onClick={isListening ? stopListening : startListening}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                        title={isListening ? t('input.stopListening') : t('input.startListening')}
                        aria-label={isListening ? t('input.stopListening') : t('input.startListening')}
                        aria-pressed={isListening}
                    >
                        {isListening ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                    </button>

                    <div className="h-8 w-px bg-white/5 mx-1" />

                    <div data-testid="model-selector">
                        <ModelSelector
                            selectedProvider={selectedProvider}
                            selectedModel={selectedModel}
                            onSelect={(p, m) => {
                                setSelectedProvider(p);
                                setSelectedModel(m);
                            }}
                            settings={appSettings || undefined}
                            groupedModels={groupedModels || undefined}
                            quotas={quotas}
                            codexUsage={codexUsage}
                            onOpenChange={setIsModelMenuOpen}
                            contextTokens={contextTokens}
                            language={language || 'en'}
                            toggleFavorite={toggleFavorite}
                            isFavorite={isFavorite}
                        />
                    </div>
                </div>

                {/* Text Input */}
                <textarea
                    data-testid="chat-textarea"
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        t('input.placeholder.default')
                    }
                    className="flex-1 bg-transparent border-none focus:border-none focus:ring-offset-0 ring-offset-0 ring-0 focus:ring-0 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none py-2.5 max-h-[200px]"
                    rows={1}
                    aria-label={t('input.placeholder.default')}
                    aria-describedby="chat-input-hint"
                />

                {/* Send/Stop Button */}
                <button
                    onClick={isLoading ? stopGeneration : () => sendMessage()}
                    disabled={!isLoading && !input.trim() && attachments.length === 0}
                    className={cn(
                        "p-2 rounded-lg transition-all duration-200 flex items-center justify-center mb-0.5",
                        isLoading
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : (input.trim() || attachments.length > 0)
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20 hover:bg-purple-500"
                                : "bg-white/5 text-zinc-600 cursor-not-allowed"
                    )}
                    aria-label={isLoading ? t('common.stop') : t('common.send')}
                >
                    {isLoading ? (
                        <Square size={18} fill="currentColor" className="animate-pulse" aria-hidden="true" />
                    ) : (
                        <Send size={18} className={cn((input.trim() || attachments.length > 0) && "ml-0.5")} aria-hidden="true" />
                    )}
                </button>
            </div>

            <div className="absolute bottom-1 right-4 text-[10px] text-zinc-700 pointer-events-none select-none">
                {selectedProvider}
            </div>
        </div >
    )
}, (prevProps, nextProps) => {
    // Memoization comparison - only re-render if props actually change
    return (
        prevProps.fileInputRef === nextProps.fileInputRef &&
        prevProps.textareaRef === nextProps.textareaRef &&
        prevProps.showFileMenu === nextProps.showFileMenu &&
        prevProps.setShowFileMenu === nextProps.setShowFileMenu
    );
})
