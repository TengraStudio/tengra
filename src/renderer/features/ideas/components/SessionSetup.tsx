import { IdeaCategory, IdeaSessionConfig } from '@shared/types/ideas';
import { Eye, Loader2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { ModelSelector } from '../../models/components/ModelSelector';

import { CategorySelector } from './CategorySelector';
import { MarketPreviewModal } from './MarketPreviewModal';

interface SessionSetupProps {
    onCreateSession: (config: IdeaSessionConfig) => Promise<void>
    isLoading: boolean
}

export const SessionSetup: React.FC<SessionSetupProps> = ({
    onCreateSession,
    isLoading
}) => {
    const { t } = useTranslation();
    const {
        selectedProvider,
        selectedModel,
        handleSelectModel,
        groupedModels,
        setIsModelMenuOpen,
        toggleFavorite,
        isFavorite
    } = useModel();

    const { appSettings, quotas, codexUsage } = useAuth();

    const [categories, setCategories] = useState<IdeaCategory[]>([]);
    const [maxIdeas, setMaxIdeas] = useState(5);
    const [customPrompt, setCustomPrompt] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [marketPreview, setMarketPreview] = useState<Array<{
        category: IdeaCategory
        summary: string
        keyTrends: string[]
        marketSize: string
        competition: string
    }> | null>(null);

    const handlePreviewMarket = async () => {
        if (categories.length === 0) { return; }

        setShowPreview(true);
        setIsLoadingPreview(true);
        setMarketPreview(null);

        try {
            const response = await window.electron.ideas.generateMarketPreview(categories);
            if (response.success && response.data) {
                setMarketPreview(response.data);
            }
        } catch (err) {
            console.error('Failed to generate market preview:', err);
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedModel || categories.length === 0) { return; }

        await onCreateSession({
            model: selectedModel,
            provider: selectedProvider,
            categories,
            maxIdeas,
            customPrompt: customPrompt.trim() || undefined
        });
    };

    const isValid = selectedModel && categories.length > 0;

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

            {/* Custom prompt (optional) */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/90 flex items-center justify-between">
                    <span>{t('ideas.customPrompt.label')}</span>
                    <span className="text-xs text-muted-foreground font-normal">{t('ideas.customPrompt.optional')}</span>
                </label>
                <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    disabled={isLoading}
                    placeholder={t('ideas.customPrompt.placeholder')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
                />
                <p className="text-xs text-muted-foreground/60">
                    {t('ideas.customPrompt.hint')}
                </p>
            </div>

            {/* Preview Market Button */}
            {categories.length > 0 && (
                <button
                    type="button"
                    onClick={() => void handlePreviewMarket()}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 text-foreground border border-border/50"
                >
                    <Eye className="w-4 h-4" />
                    {t('ideas.previewMarket') || 'Preview Market Research'}
                </button>
            )}

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

            {/* Market Preview Modal */}
            {showPreview && (
                <MarketPreviewModal
                    categories={categories}
                    onClose={() => setShowPreview(false)}
                    onContinue={() => {
                        setShowPreview(false);
                        // Submit the form to start research
                        void handleSubmit(new Event('submit') as unknown as React.FormEvent);
                    }}
                    isLoading={isLoadingPreview}
                    preview={marketPreview}
                />
            )}
        </form>
    );
};
