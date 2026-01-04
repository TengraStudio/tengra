import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Sparkles, BrainCircuit, Zap, Server, Box, Search, Check, LayoutGrid, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppSettings } from '../../main/services/settings.service'
import { KNOWN_DEFINITIONS, ModelDefinition } from '../lib/model-categorization'

interface ModelSelectorProps {
    selectedProvider: string
    selectedModel: string
    onSelect: (provider: string, model: string) => void
    settings?: AppSettings
    localModels?: any[]
    proxyModels?: any[]
    quotas?: any
    codexUsage?: any
    onOpenChange?: (isOpen: boolean) => void
}

export function ModelSelector({ selectedProvider, selectedModel, onSelect, settings, localModels = [], proxyModels = [], quotas = null, codexUsage = null, onOpenChange }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [dropUp, setDropUp] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        onOpenChange?.(isOpen)
    }, [isOpen, onOpenChange])

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
            setDropUp(spaceBelow < 300)
        }
    }, [isOpen])

    // Antigravity quota groups - models that share the same quota
    const ANTIGRAVITY_QUOTA_GROUPS: Record<string, string[]> = {
        'claude': [
            'gemini-claude-sonnet-4-5',
            'gemini-claude-sonnet-4-5-thinking',
            'gemini-claude-opus-4-5-thinking'
        ],
        'gemini-3-pro': [
            'gemini-3-pro-preview',
            'gemini-3-pro-low',
            'gemini-3-pro-high'
        ]
        // Note: gemini-3-flash-preview has its own quota
    };

    const isModelDisabled = (modelId: string, provider: string) => {
        if (!quotas && !codexUsage) return false;
        const lowerModelId = modelId.toLowerCase();

        // 1. Check Codex/OpenAI Quotas - If exhausted, disable ALL OpenAI/Codex models
        if (provider === 'copilot' || provider === 'codex' || provider === 'openai') {
            const codex = codexUsage?.data || codexUsage;
            // Weekly quota check for Codex
            if (codex?.remaining <= 0 && codex?.limit > 0) {
                // For Codex models, check if it's a codex/gpt-5 model specifically
                if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5')) {
                    return true;
                }
            }
        }

        // 2. Check Copilot Credits - If exhausted, disable ALL Copilot models  
        if (provider === 'copilot') {
            const copilotQuota = quotas?.copilot || quotas?.data?.copilot;
            if (copilotQuota?.remaining <= 0 && copilotQuota?.limit > 0) {
                return true;
            }
        }

        // 3. Antigravity Quota Handling - Model-specific with shared groups
        if (provider === 'antigravity' || lowerModelId.includes('gemini-') || lowerModelId.includes('claude')) {
            const agQuota = quotas?.antigravity || quotas?.data?.antigravity;
            if (agQuota) {
                // Check if this specific model is rate limited
                const modelQuota = agQuota[modelId] || agQuota[lowerModelId];
                if (modelQuota?.exhausted || modelQuota?.remaining <= 0) {
                    return true;
                }

                // Check shared quota groups
                for (const [, groupModels] of Object.entries(ANTIGRAVITY_QUOTA_GROUPS)) {
                    if (groupModels.some(m => m.toLowerCase() === lowerModelId)) {
                        // Check if any model in this group is exhausted
                        for (const groupModel of groupModels) {
                            const gQuota = agQuota[groupModel] || agQuota[groupModel.toLowerCase()];
                            if (gQuota?.exhausted || gQuota?.remaining <= 0) {
                                return true;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // 4. Generic Provider Quotas (fallback)
        const qData = quotas?.data || quotas;
        if (qData) {
            const providerKey = lowerModelId.includes('gemini') && !lowerModelId.includes('claude')
                ? 'gemini'
                : (lowerModelId.includes('claude') ? 'anthropic' : 'openai');
            const target = qData[providerKey];
            if (target && target.remaining <= 0 && target.limit > 0) return true;
        }

        return false;
    }

    const categories = useMemo(() => {
        const catsMap: Record<string, { id: string, name: string, icon: any, color: string, bg: string, providerId: string, models: Map<string, { id: string, label: string, disabled: boolean }> }> = {
            copilot: { id: 'copilot', name: 'GitHub Copilot', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', providerId: 'copilot', models: new Map() },
            openai: { id: 'openai', name: 'OpenAI', icon: Sparkles, color: 'text-green-400', bg: 'bg-green-500/10', providerId: 'openai', models: new Map() },
            claude: { id: 'claude', name: 'Anthropic', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-pink-500/10', providerId: 'anthropic', models: new Map() },
            gemini: { id: 'gemini', name: 'Google Gemini', icon: BrainCircuit, color: 'text-blue-400', bg: 'bg-blue-500/10', providerId: 'gemini', models: new Map() },
            antigravity: { id: 'antigravity', name: 'Antigravity (Google)', icon: LayoutGrid, color: 'text-pink-400', bg: 'bg-pink-500/10', providerId: 'antigravity', models: new Map() },
            ollama: { id: 'ollama', name: 'Ollama (Local)', icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10', providerId: 'ollama', models: new Map() },
            custom: { id: 'custom', name: 'Proxy / Custom', icon: Box, color: 'text-zinc-400', bg: 'bg-zinc-500/10', providerId: 'openai', models: new Map() }
        }

        // Helper to infer category from model ID
        const inferCategory = (modelId: string, providerHint?: string): string => {
            const id = modelId.toLowerCase();
            if (id.includes('gpt-') || id.includes('codex') || id.includes('o1-') || id.includes('o3-')) return 'copilot';
            if (id.includes('claude') && !id.includes('gemini')) return 'claude';
            if ((id.startsWith('gemini-') || id.includes('gemini')) && !id.includes('claude')) return 'gemini';
            if (providerHint === 'antigravity') return 'antigravity';
            return providerHint || 'custom';
        };

        localModels.forEach(m => {
            catsMap.ollama.models.set(m.name, { id: m.name, label: m.name, disabled: false })
        })


        // Populate from Proxy Scraped Models first (they have real-time availability info)
        proxyModels.forEach(m => {
            const modelId = m.id;
            const providerHint = m.owned_by || m.provider || '';
            let targetCat = inferCategory(modelId, providerHint);
            if (targetCat === 'anthropic') targetCat = 'claude';
            if (!catsMap[targetCat]) targetCat = 'custom';

            const label = (KNOWN_DEFINITIONS as any)[targetCat]?.[modelId]?.label || m.name || modelId;
            catsMap[targetCat].models.set(modelId, { id: modelId, label, disabled: isModelDisabled(modelId, targetCat) });
        })

        // Add known models 
        const knownModels = Object.entries(KNOWN_DEFINITIONS)
            .flatMap(([_provider, models]) => Object.values(models as Record<string, ModelDefinition>))

        knownModels.forEach(def => {
            let targetCat = def.provider === 'custom' ? 'custom' : def.provider as string
            if (targetCat === 'anthropic') targetCat = 'claude'
            if (!catsMap[targetCat]) targetCat = 'custom'

            const disabled = isModelDisabled(def.id, targetCat);
            // If model already exists from proxy, update it but don't overwrite if proxy has more up-to-date availability?
            // Actually proxy availability is just existence. Quota check (isModelDisabled) is what matters.
            // So we can just overwrite or set.
            catsMap[targetCat].models.set(def.id, { id: def.id, label: def.label, disabled })
        })

        const hidden = new Set<string>(settings?.general?.hiddenModels || [])

        return Object.values(catsMap).map(cat => ({
            ...cat,
            models: Array.from(cat.models.values()).filter(m => {
                if (searchQuery) return m.label.toLowerCase().includes(searchQuery.toLowerCase()) || m.id.toLowerCase().includes(searchQuery.toLowerCase())
                return !hidden.has(m.id) || m.id === selectedModel
            }).sort((a, b) => a.label.localeCompare(b.label))
        })).filter(cat => cat.models.length > 0)

    }, [localModels, proxyModels, searchQuery, settings, selectedModel, quotas, codexUsage])

    const currentCategory = categories.find(c => c.models.some(m => m.id === selectedModel))
        || categories.find(c => c.id === selectedProvider)
        || categories.find(c => c.id === 'copilot')

    const currentModelLabel = useMemo(() => {
        for (const cat of categories) {
            const match = cat.models.find(m => m.id === selectedModel)
            if (match) return match.label
        }
        return selectedModel
    }, [categories, selectedModel])

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
                            {currentModelLabel || 'Select Model'}
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

                        <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
                            {categories.map(category => (
                                <div key={category.id} className="mb-1">
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 bg-[#0A0A0A]/95 sticky top-0 z-5 border-b border-white/5 shadow-sm">
                                        <span>{category.name}</span>
                                    </div>
                                    <div className="px-1">
                                        {category.models.map(model => (
                                            <button
                                                key={model.id}
                                                disabled={model.disabled && selectedModel !== model.id}
                                                onClick={() => {
                                                    onSelect(category.id, model.id)
                                                    setIsOpen(false)
                                                    setSearchQuery('')
                                                }}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-left text-sm group relative my-0.5",
                                                    (selectedModel === model.id && selectedProvider === category.id)
                                                        ? "bg-white/10 text-white font-medium"
                                                        : (model.disabled ? "opacity-30 cursor-not-allowed grayscale" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200")
                                                )}
                                            >
                                                <span className="truncate flex-1">{model.label}</span>
                                                {model.disabled && (
                                                    <span className="text-[9px] font-bold text-red-500 flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded leading-none">
                                                        <Info className="w-2.5 h-2.5" />
                                                        FULL
                                                    </span>
                                                )}
                                                {selectedModel === model.id && selectedProvider === category.id && (
                                                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}