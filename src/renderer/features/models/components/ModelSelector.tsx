import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
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
import type { AppSettings, QuotaResponse, CodexUsage } from '@/types'
import type { GroupedModels } from '../utils/model-fetcher'
import { useDebounce } from '@/hooks/useDebounce'

import { useTranslation, Language } from '@/i18n'

interface ModelSelectorProps {
    selectedProvider: string
    selectedModel: string
    onSelect: (provider: string, model: string) => void
    settings?: AppSettings
    groupedModels?: GroupedModels
    quotas?: QuotaResponse | null
    codexUsage?: CodexUsage | null
    onOpenChange?: (isOpen: boolean) => void
    contextTokens?: number
    language?: Language
}

export function ModelSelector({ selectedProvider, selectedModel, onSelect, settings, groupedModels, quotas = null, codexUsage = null, onOpenChange, contextTokens = 0, language = 'en' }: ModelSelectorProps) {
    const { t } = useTranslation(language)
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const [usageLimitChecks, setUsageLimitChecks] = useState<Record<string, { allowed: boolean; reason?: string }>>({})

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

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node
            // Use refs safely in essence, ignoring the overly aggressive lint warning
            // for what is a standard Floating UI/React pattern.
            const ref1 = (refs.domReference as React.MutableRefObject<HTMLElement | null>).current;
            const ref2 = (refs.floating as React.MutableRefObject<HTMLElement | null>).current;
            const isInsideContainer = ref1?.contains(target)
            const isInsideDropdown = ref2?.contains(target)

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
    }, [isOpen, refs.domReference, refs.floating]);


    // Antigravity quota groups - models that share the same quota
    const ANTIGRAVITY_QUOTA_GROUPS = useMemo(() => ({
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
    }), []);

    // Check usage limits for all models
    useEffect(() => {
        if (!settings?.modelUsageLimits) return
        
        const checkLimits = async () => {
            const checks: Record<string, { allowed: boolean; reason?: string }> = {}
            
            // Check limits for all models in groupedModels
            if (groupedModels) {
                for (const [provider, group] of Object.entries(groupedModels)) {
                    for (const model of group.models) {
                        const modelId = model.id || ''
                        if (!modelId) continue
                        const key = `${provider}:${modelId}`
                        try {
                            const result = await window.electron.checkUsageLimit(provider, modelId)
                            checks[key] = result
                        } catch (error) {
                            checks[key] = { allowed: true } // Default to allowed on error
                        }
                    }
                }
            }
            
            setUsageLimitChecks(checks)
        }
        
        checkLimits()
    }, [settings?.modelUsageLimits, groupedModels])

    const isModelDisabled = useCallback((modelId: string, provider: string) => {
        if (!quotas && !codexUsage && !settings?.modelUsageLimits) return false;
        const lowerModelId = modelId.toLowerCase();
        
        // Check usage limits first
        const limitKey = `${provider}:${modelId}`
        const limitCheck = usageLimitChecks[limitKey]
        if (limitCheck && !limitCheck.allowed) {
            return true
        }

        // 1. Check Codex/OpenAI Quotas and Usage Limits
        if (provider === 'codex' || provider === 'openai') {
            const codex = codexUsage as { usage?: { weeklyUsedPercent?: number; dailyUsedPercent?: number; weeklyLimit?: number }; data?: { usage?: { weeklyUsedPercent?: number; dailyUsedPercent?: number; weeklyLimit?: number } } } | null;
            const usage = codex?.usage || codex?.data?.usage;
            if (usage) {
                // Check user-defined usage limits from settings
                const codexLimits = settings?.modelUsageLimits?.codex
                
                // Check weekly limit from settings
                if (codexLimits?.weekly?.enabled && usage.weeklyLimit !== undefined && usage.weeklyLimit > 0) {
                    const weeklyRemainingPercent = 100 - (usage.weeklyUsedPercent ?? 0)
                    const maxAllowedPercent = codexLimits.weekly.percentage
                    if (weeklyRemainingPercent < maxAllowedPercent) {
                        if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1')) {
                            return true;
                        }
                    }
                }
                
                // Check daily limit from settings
                const usageExt = usage as { dailyLimit?: number }
                if (codexLimits?.daily?.enabled && usageExt.dailyLimit !== undefined && usageExt.dailyLimit > 0) {
                    const dailyRemainingPercent = 100 - (usage.dailyUsedPercent ?? 0)
                    const maxAllowedPercent = codexLimits.daily.percentage
                    if (dailyRemainingPercent < maxAllowedPercent) {
                        if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1')) {
                            return true;
                        }
                    }
                }
                
                // If weekly limit is 0, disable all Codex models
                if (usage.weeklyLimit === 0) {
                    if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1')) {
                        return true;
                    }
                }
                // Otherwise check daily remaining percentage
                else if ((usage.dailyUsedPercent ?? 0) >= 100) {
                    if (lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1')) {
                        return true;
                    }
                }
            }
        }

        // 2. Check Copilot Credits - check remaining number (0-5 means disabled)
        if (provider === 'copilot') {
            const copilotQuota = (quotas as { copilot?: { remaining: number; limit: number } })?.copilot ||
                (quotas as { data?: { copilot?: { remaining: number; limit: number } } })?.data?.copilot;
            if (copilotQuota) {
                // Disable if remaining is 0-5
                if (copilotQuota.remaining <= 5 && copilotQuota.limit > 0) {
                    return true;
                }
            }
        }

        // 3. Antigravity Quota Handling - disable if percentage is 0-5% or below user-defined limit
        if (provider === 'antigravity' ) {
            // Check user-defined usage limits from settings
            const antigravityLimits = settings?.modelUsageLimits?.antigravity
            const modelLimit = antigravityLimits?.[modelId] || antigravityLimits?.[lowerModelId]
            
            if (modelLimit?.enabled) {
                // Check models array in quotas for percentage
                if (quotas && 'models' in quotas && Array.isArray(quotas.models)) {
                    const modelQuotaItem = quotas.models.find((m: any) => 
                        m.id?.toLowerCase() === lowerModelId || 
                        m.id?.toLowerCase() === modelId.toLowerCase()
                    );
                    if (modelQuotaItem) {
                        // Get model's remaining quota percentage
                        const modelRemainingPercent = (modelQuotaItem.percentage ?? (modelQuotaItem.quotaInfo?.remainingFraction ?? 1) * 100);
                        // Check if model's remaining quota is below the user-defined limit
                        if (modelRemainingPercent < modelLimit.percentage) {
                            return true;
                        }
                    }
                }
            }
            
            // Check models array in quotas for percentage
            if (quotas && 'models' in quotas && Array.isArray(quotas.models)) {
                const modelQuotaItem = quotas.models.find((m: any) => 
                    m.id?.toLowerCase() === lowerModelId || 
                    m.id?.toLowerCase() === modelId.toLowerCase()
                );
                if (modelQuotaItem) {
                    // Check percentage - disable if 0-5%
                    const percentage = modelQuotaItem.percentage ?? (modelQuotaItem.quotaInfo?.remainingFraction ?? 1) * 100;
                    if (percentage <= 5) {
                        return true;
                    }
                }
            }
            
            // Fallback to old structure
            const agQuota = (quotas as { antigravity?: Record<string, { exhausted?: boolean; remaining: number; percentage?: number }> })?.antigravity ||
                (quotas as { data?: { antigravity?: Record<string, { exhausted?: boolean; remaining: number; percentage?: number }> } })?.data?.antigravity;
            if (agQuota) {
                const modelQuota = agQuota[modelId] || agQuota[lowerModelId];
                if (modelQuota) {
                    // Check percentage if available, otherwise check exhausted/remaining
                    if (modelQuota.percentage !== undefined && modelQuota.percentage <= 5) {
                        return true;
                    }
                    if (modelQuota.exhausted || modelQuota.remaining <= 0) {
                        return true;
                    }
                }

                for (const [, groupModels] of Object.entries(ANTIGRAVITY_QUOTA_GROUPS)) {
                    if (groupModels.some(m => m.toLowerCase() === lowerModelId)) {
                        for (const groupModel of groupModels) {
                            const gQuota = agQuota[groupModel] || agQuota[groupModel.toLowerCase()];
                            if (gQuota) {
                                if (gQuota.percentage !== undefined && gQuota.percentage <= 5) {
                                    return true;
                                }
                                if (gQuota.exhausted || gQuota.remaining <= 0) {
                                    return true;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }

        return false;
    }, [quotas, codexUsage, ANTIGRAVITY_QUOTA_GROUPS, settings, usageLimitChecks]);

    const categories = useMemo(() => {
        if (!groupedModels) return []

        interface ModelItem {
            id: string;
            label: string;
            disabled: boolean;
            provider: string;
            type: string;
        }

        interface Category {
            id: string;
            name: string;
            icon: React.ElementType;
            color: string;
            bg: string;
            providerId: string;
            models: ModelItem[];
        }

        const cats: Category[] = [
            { id: 'copilot', name: 'GitHub Copilot', icon: Zap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', providerId: 'copilot', models: [] },
            { id: 'openai', name: 'OpenAI', icon: Sparkles, color: 'text-green-400', bg: 'bg-green-500/10', providerId: 'openai', models: [] },
            { id: 'claude', name: 'Anthropic', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-pink-500/10', providerId: 'anthropic', models: [] },

            { id: 'antigravity', name: 'Antigravity', icon: LayoutGrid, color: 'text-pink-400', bg: 'bg-pink-500/10', providerId: 'antigravity', models: [] },
            { id: 'ollama', name: t('modelSelector.ollamaLocal'), icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10', providerId: 'ollama', models: [] },
            { id: 'custom', name: t('modelSelector.proxyCustom'), icon: Box, color: 'text-zinc-400', bg: 'bg-zinc-500/10', providerId: 'openai', models: [] }
        ]

        const brandsMapping: Array<{ key: keyof GroupedModels, catId: string }> = [
            { key: 'ollama', catId: 'ollama' },
            { key: 'copilot', catId: 'copilot' },
            { key: 'openai', catId: 'openai' },
            { key: 'anthropic', catId: 'claude' },

            { key: 'antigravity', catId: 'antigravity' },
            { key: 'custom', catId: 'custom' }
        ]

        const hidden = new Set<string>(settings?.general?.hiddenModels || [])
        const searchLower = debouncedSearchQuery.toLowerCase()

        for (const mapping of brandsMapping) {
            const group = groupedModels[mapping.key]
            const models = group?.models || []
            const cat = cats.find(c => c.id === mapping.catId)
            if (!cat) continue

            interface RawModel {
                id?: string
                name?: string
                provider?: string
                quota?: { percentage?: number }
                type?: string
            }

            for (const mRaw of models) {
                const m = mRaw as RawModel;
                const id = m.id || '';
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
                    disabled: isModelDisabled(id, m.provider || '') || (m.quota?.percentage !== undefined && m.quota.percentage <= 1) || false,
                    provider: m.provider || '',
                    type: m.type || 'text'
                });
            }
            cat.models.sort((a, b) => a.label.localeCompare(b.label))
        }

        return cats.filter(cat => cat.models.length > 0)
    }, [groupedModels, debouncedSearchQuery, settings, selectedModel, t, isModelDisabled])

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

    const currentModelLabel: string = currentModelInfo?.label || selectedModel || '';
    const currentCategory = categories.find(c => c.models.some(m => m.id === selectedModel))
        || categories.find(c => c.id === selectedProvider);

    const contextLimit = useMemo(() => {
        const id = selectedModel.toLowerCase()
        if (id.includes('gpt-4') || id.includes('o1-') || id.includes('gpt-5') || id.includes('codex')) return 128000
        if (id.includes('claude-3-5') || id.includes('claude-3')) return 200000
        if (id.includes('gemini-1.5')) return 1000000
        if (id.includes('gemini-3')) return 2000000
        if (id.includes('gpt-3.5')) return 160000
        return 32000
    }, [selectedModel]);

    const contextUsagePercent = Math.min(100, (contextTokens / contextLimit) * 100)

    // Callback refs to satisfy aggressive linting
    const setReferenceNode = useCallback((node: HTMLElement | null) => {
        refs.setReference(node);
    }, [refs]);

    const setFloatingNode = useCallback((node: HTMLElement | null) => {
        refs.setFloating(node);
    }, [refs]);

    return (
        <div className="relative" ref={setReferenceNode}>
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
                            ref={setFloatingNode}
                            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
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
                                        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
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
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelect(model.provider, model.id);
                                                            setTimeout(() => {
                                                                setIsOpen(false);
                                                                setSearchQuery('');
                                                            }, 50);
                                                        }}
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
