import { IdeaCategory, IdeaSessionConfig } from '@shared/types/ideas'
import { Loader2, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import { useModel } from '@/context/ModelContext'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { CategorySelector } from './CategorySelector'
import { ModelSelector } from '../../models/components/ModelSelector'

interface SessionSetupProps {
    onCreateSession: (config: IdeaSessionConfig) => Promise<void>
    isLoading: boolean
}

export const SessionSetup: React.FC<SessionSetupProps> = ({
    onCreateSession,
    isLoading
}) => {
    const { t } = useTranslation()
    const {
        selectedProvider,
        selectedModel,
        handleSelectModel,
        groupedModels,
        setIsModelMenuOpen,
        toggleFavorite,
        isFavorite
    } = useModel()

    const { appSettings, quotas, codexUsage } = useAuth()

    const [categories, setCategories] = useState<IdeaCategory[]>([])
    const [maxIdeas, setMaxIdeas] = useState(5)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedModel || categories.length === 0) { return }

        await onCreateSession({
            model: selectedModel,
            provider: selectedProvider,
            categories,
            maxIdeas
        })
    }

    const isValid = selectedModel && categories.length > 0

    return (
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {/* Model selection */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                    {t('ideas.selectModel')}
                </h3>
                <ModelSelector
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    onSelect={handleSelectModel}
                    groupedModels={groupedModels || undefined}
                    settings={appSettings || undefined}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    onOpenChange={setIsModelMenuOpen}
                    toggleFavorite={toggleFavorite}
                    isFavorite={isFavorite}
                />
                <p className="text-xs text-white/40 mt-3">
                    {t('ideas.modelSelectorHint')}
                </p>
            </div>

            {/* Category selection */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                    {t('ideas.selectCategories')}
                </h3>
                <CategorySelector
                    selected={categories}
                    onChange={setCategories}
                    disabled={isLoading}
                />
            </div>

            {/* Max ideas slider */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-5">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-white/80">
                        {t('ideas.maxIdeas')}
                    </h3>
                    <span className="text-sm font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                        {maxIdeas}
                    </span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={100}
                    value={maxIdeas}
                    onChange={e => setMaxIdeas(Number(e.target.value))}
                    disabled={isLoading}
                    className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-white/40 mt-1">
                    <span>1</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                </div>
            </div>

            {/* Submit button */}
            <button
                type="submit"
                disabled={!isValid || isLoading}
                className={cn(
                    'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
                    isValid && !isLoading
                        ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('common.loading')}
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        {t('ideas.startResearch')}
                    </>
                )}
            </button>
        </form>
    )
}
