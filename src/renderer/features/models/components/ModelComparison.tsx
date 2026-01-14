/**
 * Multi-Model Comparison View
 * Compare responses from multiple AI models side by side.
 */

import {
BarChart3, Check,
    ChevronDown, Clock, Copy, Loader2,     Play, Plus, X, Zap} from 'lucide-react'
import React, { useCallback,useState } from 'react'

import { cn } from '@/lib/utils'

interface ModelResponse {
    model: string
    provider: string
    content: string
    tokens: number
    responseTime: number
    timestamp: number
    error?: string
}

interface ComparisonSlot {
    id: string
    provider: string
    model: string
    response?: ModelResponse
    isLoading: boolean
}

interface ModelComparisonProps {
    availableModels: { provider: string; model: string; name: string }[]
    onCompare: (prompt: string, models: { provider: string; model: string }[]) => Promise<ModelResponse[]>
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
    availableModels,
    onCompare
}) => {
    const [prompt, setPrompt] = useState('')
    const [slots, setSlots] = useState<ComparisonSlot[]>([
        { id: '1', provider: 'openai', model: 'gpt-4o', isLoading: false },
        { id: '2', provider: 'anthropic', model: 'claude-3-sonnet', isLoading: false }
    ])
    const [isComparing, setIsComparing] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const addSlot = useCallback(() => {
        if (slots.length >= 4) {return}
        const unusedModel = availableModels.find(m =>
            !slots.some(s => s.provider === m.provider && s.model === m.model)
        ) || availableModels[0]

        setSlots(prev => [...prev, {
            id: crypto.randomUUID(),
            provider: unusedModel?.provider || 'openai',
            model: unusedModel?.model || 'gpt-4o',
            isLoading: false
        }])
    }, [slots, availableModels])

    const removeSlot = useCallback((id: string) => {
        if (slots.length <= 2) {return}
        setSlots(prev => prev.filter(s => s.id !== id))
    }, [slots])

    const updateSlot = useCallback((id: string, provider: string, model: string) => {
        setSlots(prev => prev.map(s =>
            s.id === id ? { ...s, provider, model, response: undefined } : s
        ))
    }, [])

    const runComparison = useCallback(async () => {
        if (!prompt.trim() || isComparing) {return}

        setIsComparing(true)
        setSlots(prev => prev.map(s => ({ ...s, isLoading: true, response: undefined })))

        try {
            const models = slots.map(s => ({ provider: s.provider, model: s.model }))
            const responses = await onCompare(prompt, models)

            setSlots(prev => prev.map((slot, i) => ({
                ...slot,
                isLoading: false,
                response: responses[i]
            })))
        } catch (error) {
            setSlots(prev => prev.map(s => ({
                ...s,
                isLoading: false,
                response: { model: s.model, provider: s.provider, content: '', tokens: 0, responseTime: 0, timestamp: Date.now(), error: String(error) }
            })))
        } finally {
            setIsComparing(false)
        }
    }, [prompt, slots, isComparing, onCompare])

    const copyResponse = useCallback((id: string, content: string) => {
        navigator.clipboard.writeText(content)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }, [])

    const ModelSelector = ({ slot }: { slot: ComparisonSlot }) => {
        const [isOpen, setIsOpen] = useState(false)
        const currentModel = availableModels.find(m => m.provider === slot.provider && m.model === slot.model)

        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-lg text-sm transition-colors"
                >
                    <span className="font-medium">{currentModel?.name || slot.model}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border/50 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                            {availableModels.map(model => (
                                <button
                                    key={`${model.provider}-${model.model}`}
                                    onClick={() => {
                                        updateSlot(slot.id, model.provider, model.model)
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center justify-between",
                                        slot.provider === model.provider && slot.model === model.model && "bg-primary/10 text-primary"
                                    )}
                                >
                                    <span>{model.name}</span>
                                    <span className="text-xs text-muted-foreground">{model.provider}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        )
    }

    const ResponseCard = ({ slot }: { slot: ComparisonSlot }) => (
        <div className={cn(
            "flex flex-col rounded-xl border bg-card/50 overflow-hidden transition-all",
            slot.isLoading && "animate-pulse"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/20">
                <ModelSelector slot={slot} />
                <div className="flex items-center gap-1">
                    {slot.response && (
                        <button
                            onClick={() => copyResponse(slot.id, slot.response!.content)}
                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                            title="Copy response"
                        >
                            {copiedId === slot.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    {slots.length > 2 && (
                        <button
                            onClick={() => removeSlot(slot.id)}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                {slot.isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : slot.response?.error ? (
                    <div className="text-destructive text-sm">{slot.response.error}</div>
                ) : slot.response ? (
                    <p className="text-sm whitespace-pre-wrap">{slot.response.content}</p>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
                        Response will appear here
                    </div>
                )}
            </div>

            {/* Stats */}
            {slot.response && !slot.response.error && (
                <div className="flex items-center gap-4 px-4 py-2 border-t border-border/30 bg-muted/10 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(slot.response.responseTime / 1000).toFixed(2)}s
                    </span>
                    <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {slot.response.tokens} tokens
                    </span>
                    <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {(slot.response.tokens / (slot.response.responseTime / 1000)).toFixed(1)} t/s
                    </span>
                </div>
            )}
        </div>
    )

    return (
        <div className="h-full flex flex-col p-4">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold mb-1">Model Comparison</h1>
                <p className="text-sm text-muted-foreground">Compare responses from multiple AI models side by side</p>
            </div>

            {/* Prompt Input */}
            <div className="mb-4">
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter your prompt to compare across models..."
                        className="w-full h-24 bg-muted/30 border border-border/30 rounded-xl p-3 pr-24 text-sm resize-none outline-none focus:border-primary/50 transition-colors"
                    />
                    <div className="absolute right-2 bottom-2 flex gap-2">
                        <button
                            onClick={runComparison}
                            disabled={!prompt.trim() || isComparing}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                                prompt.trim() && !isComparing
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-muted text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            {isComparing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            Compare
                        </button>
                    </div>
                </div>
            </div>

            {/* Model Slots */}
            <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}>
                {slots.map(slot => (
                    <ResponseCard key={slot.id} slot={slot} />
                ))}
            </div>

            {/* Add Model Button */}
            {slots.length < 4 && (
                <button
                    onClick={addSlot}
                    className="mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl text-muted-foreground hover:text-primary transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Model
                </button>
            )}
        </div>
    )
}

export default ModelComparison
