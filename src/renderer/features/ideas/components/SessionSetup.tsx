import { IdeaCategory, IdeaSessionConfig } from '@shared/types/ideas'
import { Loader2, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useModel } from '@/context/ModelContext'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { ModelSelector } from '../../models/components/ModelSelector'

import { CategorySelector } from './CategorySelector'

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
            <div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">
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
                <p className="text-xs text-muted-foreground/60 mt-3">
                    {t('ideas.modelSelectorHint')}
                </p>
            </div>

            {/* Category selection */}
            <div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                    {t('ideas.selectCategories')}
                </h3>
                <CategorySelector
                    selected={categories}
                    onChange={setCategories}
                    disabled={isLoading}
                />
            </div>

            {/* Max ideas slider */}
            <div className="bg-muted/20 backdrop-blur-sm rounded-xl border border-border p-5">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('ideas.maxIdeas')}
                    </h3>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
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
                    className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1 font-medium">
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
                    'w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                    isValid && !isLoading
                        ? 'bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20 scale-100 hover:scale-[1.01] active:scale-[0.99]'
                        : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
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
