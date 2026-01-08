import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    FloatingPortal,
} from '@floating-ui/react'
import { ChevronDown, Sparkles, BrainCircuit, Zap, Server, Box, Search, Check, LayoutGrid, Info, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppSettings } from '@main/services/settings.service'
import type { GroupedModels } from '../utils/model-fetcher'
import { useDebouncedValue } from '@/hooks/useDebounce'

import { useTranslation, Language } from '@/i18n'

interface ModelSelectorProps {
    selectedProvider: string
    selectedModel: string
    onSelect: (provider: string, model: string) => void
    settings?: AppSettings
    groupedModels?: GroupedModels
    quotas?: any
    codexUsage?: any
    onOpenChange?: (isOpen: boolean) => void
    contextTokens?: number
    language?: Language
}

export function ModelSelector({ selectedProvider, selectedModel, onSelect, settings, groupedModels, quotas = null, codexUsage = null, onOpenChange, contextTokens = 0, language = 'en' }: ModelSelectorProps) {
    const { t } = useTranslation(language)
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

    const {
        x,
        y,
        strategy,
        refs,
        placement,
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(8),
            flip({
                fallbackAxisSideDirection: 'end',
            }),
            shift({ padding: 16 }),
        ],
        whileElementsMounted: autoUpdate,
    })

    const dropUp = placement.startsWith('top')

    useEffect(() => {
        onOpenChange?.(isOpen)
    }, [isOpen, onOpenChange])

    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node
            const isInsideContainer = refs.domReference.current?.contains(target)
            const isInsideDropdown = refs.floating.current?.contains(target)

            if (!isInsideContainer && !isInsideDropdown) {
                setIsOpen(false)
            }
        }

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isOpen, refs])


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
        if (provider === 'codex' || provider === 'openai') {
            const codex = codexUsage?.data || codexUsage;

            // Check structured usage from ChatGPT/Wham
            if (codex?.usage) {
                if (codex.usage.weeklyUsedPercent >= 100 || codex.usage.dailyUsedPercent >= 100) {
                    if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1')) {
                        return true;
                    }
                }
            }

            // Legacy check
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
        if (!groupedModels) return []

        const cats = [
            { id: 'copilot', name: 'GitHub Copilot', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', providerId: 'copilot', models: [] as any[] },
            { id: 'openai', name: 'OpenAI', icon: Sparkles, color: 'text-green-400', bg: 'bg-green-500/10', providerId: 'openai', models: [] as any[] },
            { id: 'claude', name: 'Anthropic', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-pink-500/10', providerId: 'anthropic', models: [] as any[] },
            { id: 'gemini', name: 'Google Gemini', icon: BrainCircuit, color: 'text-blue-400', bg: 'bg-blue-500/10', providerId: 'gemini', models: [] as any[] },
            { id: 'antigravity', name: 'Antigravity (Google)', icon: LayoutGrid, color: 'text-pink-400', bg: 'bg-pink-500/10', providerId: 'antigravity', models: [] as any[] },
            { id: 'ollama', name: t('modelSelector.ollamaLocal'), icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10', providerId: 'ollama', models: [] as any[] },
            { id: 'custom', name: t('modelSelector.proxyCustom'), icon: Box, color: 'text-zinc-400', bg: 'bg-zinc-500/10', providerId: 'openai', models: [] as any[] }
        ]

        const brandsMapping: Array<{ key: keyof GroupedModels, catId: string }> = [
            { key: 'ollama', catId: 'ollama' },
            { key: 'copilot', catId: 'copilot' },
            { key: 'openai', catId: 'openai' },
            { key: 'anthropic', catId: 'claude' },
            { key: 'gemini', catId: 'gemini' },
            { key: 'antigravity', catId: 'antigravity' },
            { key: 'custom', catId: 'custom' }
        ]

        const hidden = new Set<string>(settings?.general?.hiddenModels || [])
        const searchLower = debouncedSearchQuery.toLowerCase()

        for (const mapping of brandsMapping) {
            const models = groupedModels[mapping.key] || []
            const cat = cats.find(c => c.id === mapping.catId)
            if (!cat) continue

            for (const m of models) {
                const id = m.id;
                const matchesSearch = searchLower === '' ||
                    (m.name || '').toLowerCase().includes(searchLower) ||
                    id.toLowerCase().includes(searchLower);

                if (!matchesSearch || (hidden.has(id) && id !== selectedModel)) continue

                let label = m.name || id;
                label = label.replace(/^(github-|copilot-|ollama-)/i, '');
                if (label.startsWith('gpt-')) label = label.toUpperCase();

                cat.models.push({
                    id: id,
                    label: label,
                    disabled: isModelDisabled(id, m.provider) || (m.quota?.percentage !== undefined && m.quota.percentage <= 1) || false,
                    provider: m.provider,
                    type: m.type
                });
            }
            cat.models.sort((a, b) => a.label.localeCompare(b.label))
        }

        return cats.filter(cat => cat.models.length > 0)
    }, [groupedModels, debouncedSearchQuery, settings, selectedModel, quotas, codexUsage, t])

    const normalizedSelectedModel = selectedModel.toLowerCase();
    const currentCategory = categories.find(c => c.models.some(m => m.id === selectedModel))
        || categories.find(c => c.models.some(m => m.id.toLowerCase() === normalizedSelectedModel))
        || categories.find(c => c.models.some(m => m.id.replace(/\./g, '-').toLowerCase() === normalizedSelectedModel.replace(/\./g, '-')))
        || categories.find(c => c.id === selectedProvider)
        || categories.find(c => c.id === 'copilot')

    const currentModelInfo = useMemo(() => {
        const normalizedSelectedModel = selectedModel.toLowerCase();
        for (const cat of categories) {
            const match = cat.models.find(m => m.id === selectedModel)
                || cat.models.find(m => m.id.toLowerCase() === normalizedSelectedModel)
                || cat.models.find(m => m.id.replace(/\./g, '-').toLowerCase() === normalizedSelectedModel.replace(/\./g, '-'))
            if (match) return match
        }
        return null
    }, [categories, selectedModel])

    const currentModelLabel = currentModelInfo?.label || selectedModel;

    const getContextLimit = (modelId: string) => {
        const id = modelId.toLowerCase()
        if (id.includes('gpt-4') || id.includes('o1-') || id.includes('gpt-5') || id.includes('codex')) return 128000
        if (id.includes('claude-3-5') || id.includes('claude-3')) return 200000
        if (id.includes('gemini-1.5')) return 1000000
        if (id.includes('gemini-3')) return 2000000
        if (id.includes('gpt-3.5')) return 160000
        return 32000 // Default for local/other
    }

    const contextLimit = getContextLimit(selectedModel)
    const contextUsagePercent = Math.min(100, (contextTokens / contextLimit) * 100)

    return (
        <div className="relative" ref={refs.setReference}>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
                className="flex items-center gap-2.5 bg-muted/30 hover:bg-muted/40 border border-white/5 hover:border-white/20 rounded-xl px-3 py-1.5 transition-all outline-none min-w-[150px] justify-between group/sel shadow-sm"
            >
                <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-inner", currentCategory?.bg || 'bg-zinc-800')}>
                        {currentCategory?.icon && <currentCategory.icon className={cn("w-3.5 h-3.5", currentCategory?.color || 'text-zinc-400')} />}
                    </div>
                    <div className="flex flex-col items-start leading-none overflow-hidden flex-1">
                        <div className="flex items-center justify-between w-full pr-1">
                            <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.05em] truncate">
                                {currentCategory?.name || (selectedProvider ? selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1) : t('modelSelector.model'))}
                            </span>
                            {contextTokens > 0 && (
                                <span className={cn(
                                    "text-[9px] font-bold px-1 rounded leading-none transition-colors ml-1",
                                    contextUsagePercent > 90 ? "text-red-400 bg-red-400/10" :
                                        contextUsagePercent > 70 ? "text-orange-400 bg-orange-400/10" :
                                            "text-emerald-400/60 bg-emerald-400/5 group-hover/sel:text-emerald-400"
                                )}>
                                    {Math.round(contextUsagePercent)}%
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground truncate w-full mt-1 tracking-tight">
                            <span className="truncate">{currentModelLabel || t('modelSelector.selectModel')}</span>
                            {currentModelInfo?.type === 'image' && (
                                <div className="flex items-center gap-1 bg-emerald-500/10 px-1 rounded py-0.5 border border-emerald-500/20 shadow-sm shrink-0">
                                    <ImageIcon className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tight">{t('modelSelector.image')}</span>
                                </div>
                            )}
                        </div>
                        {/* Context Meter Bar */}
                        {contextTokens > 0 && (
                            <div className="w-full h-[2px] bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-500",
                                        contextUsagePercent > 90 ? "bg-red-500" :
                                            contextUsagePercent > 70 ? "bg-orange-500" : "bg-emerald-500/50"
                                    )}
                                    style={{ width: `${contextUsagePercent}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform shrink-0 ml-1 group-hover/sel:text-zinc-300", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <FloatingPortal>
                        <motion.div
                            ref={refs.setFloating}
                            onMouseDown={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{
                                position: strategy,
                                top: y ?? 0,
                                left: x ?? 0,
                                zIndex: 9999
                            }}
                            className="w-72 max-h-[70vh] flex flex-col bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                            <div className="p-2 border-b border-white/5 bg-white/5 sticky top-0 z-10">
                                <div className="flex items-center gap-2 bg-black/50 rounded-lg px-2 py-1.5 border border-white/5 focus-within:border-white/20 transition-colors">
                                    <Search className="w-3.5 h-3.5 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder={t('modelSelector.searchModels')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-zinc-600 outline-none text-zinc-300"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
                                {categories.length === 0 ? (
                                    <div className="p-4 space-y-3">
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-20" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-8 w-full" />
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-16" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-8 w-full" />
                                                <Skeleton className="h-8 w-full" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    categories.map(category => (
                                        <div key={category.id} className="mb-1">
                                            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500 flex items-center gap-2 bg-[#0A0A0A]/95 sticky top-0 z-5 border-b border-white/5 shadow-sm">
                                                <span>{category.name}</span>
                                            </div>
                                            <div className="px-1">
                                                {category.models.map(model => (
                                                    <button
                                                        key={`${category.id}-${model.provider}-${model.id}`}
                                                        // disabled={model.disabled && selectedModel !== model.id} // DEBUG: Force enabled
                                                        // DEBUG: onClick with delayed close is the standard successful pattern
                                                        onClick={(e) => {
                                                            console.log('[ModelSelector] Button onClick', { provider: model.provider, id: model.id });
                                                            e.stopPropagation();
                                                            onSelect(model.provider, model.id);
                                                            // Close on next tick to allow event propagation/settling
                                                            setTimeout(() => {
                                                                setIsOpen(false);
                                                                setSearchQuery('');
                                                            }, 50);
                                                        }}
                                                        // Removed aggressive onMouseDown to prevent conflict
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-left text-sm group relative my-0.5",
                                                            (selectedModel === model.id && selectedProvider === model.provider)
                                                                ? "bg-white/10 text-white font-bold"
                                                                : (model.disabled ? "opacity-30 cursor-not-allowed grayscale" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200")
                                                        )}
                                                    >
                                                        <span className="truncate flex-1 flex items-center gap-2">
                                                            {model.label}
                                                            {model.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
                                                        </span>
                                                        {model.type === 'image' && (
                                                            <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded leading-none mr-1">
                                                                {t('modelSelector.image')}
                                                            </span>
                                                        )}
                                                        {model.disabled && (
                                                            <span className="text-[9px] font-black text-red-500 flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded leading-none">
                                                                <Info className="w-2.5 h-2.5" />
                                                                {t('modelSelector.limit')}
                                                            </span>
                                                        )}
                                                        {(selectedModel === model.id && selectedProvider === model.provider) && (
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
                    </FloatingPortal>
                )}
            </AnimatePresence>
        </div>
    )
}
