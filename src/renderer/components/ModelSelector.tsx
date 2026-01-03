
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Sparkles, BrainCircuit, Zap, Server, Box, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppSettings } from '../../main/services/settings.service'

interface ModelSelectorProps {
    selectedProvider: string
    selectedModel: string
    onSelect: (provider: string, model: string) => void
    settings?: AppSettings
    localModels?: any[]
    proxyModels?: any[]
}

// Unified model categorization - Codex models merged into Copilot
const KNOWN_MODELS = {
    copilot: [
        'gpt-4o', 'gpt-4', 'claude-3.5-sonnet',
        'gpt-5.1-codex', 'gpt-5-codex', // Merged here as requested
        'o1', 'o1-preview', 'o1-mini'
    ],
    openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3.5-sonnet'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
}

export function ModelSelector({ selectedProvider, selectedModel, onSelect, settings, localModels = [], proxyModels = [] }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [dropUp, setDropUp] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            // 300px is roughly the height we want. If less space, go up.
            setDropUp(spaceBelow < 300)
        }
    }, [isOpen])

    const categories = useMemo(() => {
        // Helper to determine category for any given model ID
        const getCategoryId = (model: string): string => {
            const m = model.toLowerCase()
            // 1. Explicit Copilot / Codex / GPT-5
            if (KNOWN_MODELS.copilot.includes(model) || m.includes('codex') || m.startsWith('gpt-5') || m.startsWith('copilot-')) return 'copilot'
            // 2. Explicit OpenAI
            if (KNOWN_MODELS.openai.includes(model)) return 'openai'
            // 3. Explicit Anthropic
            if (KNOWN_MODELS.anthropic.includes(model) || m.startsWith('claude-')) return 'anthropic'
            // 4. Explicit Gemini
            if (KNOWN_MODELS.gemini.includes(model) || m.startsWith('gemini-')) return 'gemini'
            // 5. Fallback heuristics
            if (m.startsWith('gpt-')) return 'openai'
            return 'custom'
        }

        // Initialize Categories
        const catsMap: Record<string, { id: string, name: string, icon: any, color: string, bg: string, providerId: string, models: Set<string> }> = {
            ollama: { id: 'ollama', name: 'Ollama (Local)', icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10', providerId: 'ollama', models: new Set(localModels.map(m => m.name)) },
            copilot: { id: 'copilot', name: 'GitHub Copilot', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', providerId: 'copilot', models: new Set(KNOWN_MODELS.copilot) },
            openai: { id: 'openai', name: 'OpenAI', icon: Sparkles, color: 'text-green-400', bg: 'bg-green-500/10', providerId: 'openai', models: new Set(KNOWN_MODELS.openai) },
            anthropic: { id: 'anthropic', name: 'Anthropic', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-500/10', providerId: 'claude', models: new Set(KNOWN_MODELS.anthropic) },
            gemini: { id: 'gemini', name: 'Google Gemini', icon: BrainCircuit, color: 'text-blue-400', bg: 'bg-blue-500/10', providerId: 'gemini', models: new Set(KNOWN_MODELS.gemini) },
            custom: { id: 'custom', name: 'Proxy / Custom', icon: Box, color: 'text-zinc-400', bg: 'bg-zinc-500/10', providerId: 'openai', models: new Set() }
        }

        // Distribute Proxy Models
        proxyModels.forEach(pm => {
            const modelName = pm.id || pm.name
            if (!modelName) return
            const catId = getCategoryId(modelName)
            // If it's already in the set (from KNOWN_MODELS), this just dedupes.
            // If it's new (e.g. gpt-5.1-codex-mini), it gets added to the correct category.
            if (catsMap[catId]) {
                catsMap[catId].models.add(modelName)
            } else {
                catsMap.custom.models.add(modelName)
            }
        })

        // Filter and Convert to Array
        const hidden = new Set<string>(settings?.general?.hiddenModels || [])

        return Object.values(catsMap).map(cat => ({
            ...cat,
            models: Array.from(cat.models).filter(m => {
                if (searchQuery) return m.toLowerCase().includes(searchQuery.toLowerCase())
                return !hidden.has(m) || m === selectedModel
            })
        })).filter(cat => cat.models.length > 0)

    }, [localModels, proxyModels, searchQuery, settings, selectedModel])

    const currentCategory = categories.find(c => c.models.includes(selectedModel)) || categories.find(c => c.id === 'copilot')

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-muted/20 hover:bg-muted/30 border border-border/50 hover:border-border/80 rounded-lg px-2 sm:px-3 py-1.5 transition-all outline-none min-w-[140px] justify-between"
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0", currentCategory?.bg || 'bg-zinc-800')}>
                        {currentCategory?.icon && <currentCategory.icon className={cn("w-3 h-3", currentCategory?.color || 'text-zinc-400')} />}
                    </div>
                    <div className="flex flex-col items-start leading-none overflow-hidden">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate w-full">
                            {currentCategory?.name || selectedProvider}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate w-full">
                            {selectedModel || 'Select Model'}
                        </span>
                    </div>
                </div>
                <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform shrink-0", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className={cn(
                            "absolute z-[100] left-0 w-72 max-h-[500px] flex flex-col bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden",
                            dropUp ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
                        )}
                    >
                        {/* Search */}
                        <div className="p-2 border-b border-white/5 bg-white/5 backdrop-blur-sm sticky top-0 z-10">
                            <div className="flex items-center gap-2 bg-black/50 rounded-lg px-2 py-1.5 border border-white/5 focus-within:border-white/20 transition-colors">
                                <Search className="w-3.5 h-3.5 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Search models..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-zinc-600 outline-none text-zinc-300"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
                            {categories.length === 0 ? (
                                <div className="p-4 text-center text-zinc-500 text-sm italic">
                                    No models found.
                                </div>
                            ) : (
                                categories.map(category => (
                                    <div key={category.id} className="mb-1">
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 bg-[#0A0A0A]/95 sticky top-0 z-5 border-b border-white/5 shadow-sm">
                                            <span>{category.name}</span>
                                        </div>
                                        <div className="px-1">
                                            {category.models.map(model => (
                                                <button
                                                    key={model}
                                                    onClick={() => {
                                                        onSelect(category.providerId, model)
                                                        setIsOpen(false)
                                                        setSearchQuery('')
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-left text-sm group relative my-0.5",
                                                        selectedModel === model
                                                            ? "bg-white/10 text-white font-medium"
                                                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                                    )}
                                                >
                                                    <span className="truncate flex-1">{model}</span>
                                                    {selectedModel === model && (
                                                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


        </div>
    )
}

