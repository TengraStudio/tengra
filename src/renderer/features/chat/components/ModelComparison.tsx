/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * ModelComparison - Main A/B testing panel for comparing LLM responses side-by-side.
 * Allows users to select models, enter a prompt, and view comparison results.
 */

import { AlertTriangle, GitCompareArrows, Loader2, Plus, X } from 'lucide-react';
import React, { useCallback } from 'react';

import { ResponsiveContainer } from '@/components/responsive/ResponsiveContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';

import { useModelComparison } from '../hooks/useModelComparison';

import { ComparisonCard } from './ComparisonCard';

interface ModelComparisonProps {
    availableModels?: Array<{ provider: string; model: string; label: string }>;
}

/** Model A/B Testing comparison panel component. */
export const ModelComparison: React.FC<ModelComparisonProps> = ({ availableModels = [] }) => {
    const { t } = useTranslation();
    const {
        prompt, setPrompt, selectedModels, addModel, removeModel,
        results, isComparing, error, startComparison, cancelComparison,
        ratings, rateModel,
    } = useModelComparison();

    const handleAddModel = useCallback(() => {
        if (availableModels.length === 0) { return; }
        const first = availableModels[0];
        addModel(first.provider, first.model);
    }, [availableModels, addModel]);

    const handleCompare = useCallback(() => {
        void startComparison();
    }, [startComparison]);

    const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
    }, [setPrompt]);

    return (
        <ResponsiveContainer className="w-full space-y-4">
            <Card className="p-4 space-y-4">
                {/* Title */}
                <div className="flex items-center gap-2">
                    <GitCompareArrows className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">{t('modelComparison.title')}</h3>
                </div>

                {/* Prompt input */}
                <Textarea
                    value={prompt}
                    onChange={handlePromptChange}
                    placeholder={t('modelComparison.enterPrompt')}
                    disabled={isComparing}
                    rows={3}
                />

                {/* Model selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('modelComparison.selectModels')}</label>
                    {selectedModels.map((model, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="flex-1 text-sm">{model.provider}/{model.model}</span>
                            <Button
                                variant="ghost" size="sm"
                                onClick={() => { removeModel(index); }}
                                disabled={isComparing}
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="outline" size="sm"
                        onClick={handleAddModel}
                        disabled={isComparing || availableModels.length === 0}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {t('modelComparison.addModel')}
                    </Button>
                </div>

                {/* Compare / Cancel button */}
                <Button
                    onClick={isComparing ? cancelComparison : handleCompare}
                    disabled={!isComparing && selectedModels.length < 2}
                    className="w-full"
                >
                    {isComparing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('modelComparison.comparing')}</>
                    ) : (
                        <><GitCompareArrows className="w-4 h-4 mr-2" />{t('modelComparison.compare')}</>
                    )}
                </Button>

                {/* Error display */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        <span className="text-sm text-destructive">{error}</span>
                    </div>
                )}
            </Card>

            {/* Results grid */}
            {results.length > 0 && (
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    {results.map((result) => {
                        const key = `${result.provider}:${result.model}`;
                        return (
                            <ComparisonCard
                                key={key}
                                result={result}
                                rating={ratings[key] ?? 0}
                                onRate={rateModel}
                            />
                        );
                    })}
                </div>
            )}
        </ResponsiveContainer>
    );
};

ModelComparison.displayName = 'ModelComparison';
