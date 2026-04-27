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
 * Multi-Model Comparison View
 * Compare responses from multiple AI models side by side.
 */

import { IconBolt,IconChartBar, IconCheck, IconChevronDown, IconClock, IconCopy, IconLoader2, IconPlayerPlay, IconPlus, IconX } from '@tabler/icons-react';
import React, { useCallback, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MODELCOMPARISON_1 = "absolute top-full left-0 mt-1 w-56 bg-popover border border-border/50 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto";
const C_MODELCOMPARISON_2 = "w-full h-24 bg-muted/30 border border-border/30 rounded-xl p-3 pr-24 text-sm resize-none outline-none focus:border-primary/50 transition-colors";
const C_MODELCOMPARISON_3 = "mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl text-muted-foreground hover:text-primary transition-colors";


interface ModelResponse {
    model: string;
    provider: string;
    content: string;
    tokens: number;
    responseTime: number;
    timestamp: number;
    error?: string;
}

interface ComparisonSlot {
    id: string;
    provider: string;
    model: string;
    response?: ModelResponse | undefined;
    isLoading: boolean;
}

interface ModelComparisonProps {
    availableModels: { provider: string; model: string; name: string }[];
    onCompare: (
        prompt: string,
        models: { provider: string; model: string }[]
    ) => Promise<ModelResponse[]>;
    language?: Language;
}

const ModelSelector = ({
    slot,
    availableModels,
    updateSlot,
}: {
    slot: ComparisonSlot;
    availableModels: { provider: string; model: string; name: string }[];
    updateSlot: (id: string, provider: string, model: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentModel = availableModels.find(
        m => m.provider === slot.provider && m.model === slot.model
    );

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-lg text-sm transition-colors"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={`Select model for slot ${slot.id}`}
            >
                <span className="font-medium">{currentModel?.name ?? slot.model}</span>
                <IconChevronDown
                    className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        className={C_MODELCOMPARISON_1}
                        role="listbox"
                    >
                        {availableModels.map(model => (
                            <button
                                key={`${model.provider}-${model.model}`}
                                onClick={() => {
                                    updateSlot(slot.id, model.provider, model.model);
                                    setIsOpen(false);
                                }}
                                role="option"
                                aria-selected={
                                    slot.provider === model.provider && slot.model === model.model
                                }
                                className={cn(
                                    'w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center justify-between',
                                    slot.provider === model.provider &&
                                        slot.model === model.model &&
                                        'bg-primary/10 text-primary'
                                )}
                            >
                                <span>{model.name}</span>
                                <span className="typo-caption text-muted-foreground">
                                    {model.provider}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const ResponseCardHeader = ({
    slot,
    copiedId,
    copyResponse,
    removeSlot,
    t,
    availableModels,
    updateSlot,
    slotsCount,
}: {
    slot: ComparisonSlot;
    copiedId: string | null;
    copyResponse: (id: string, content: string) => void;
    removeSlot: (id: string) => void;
    t: (key: string) => string;
    availableModels: { provider: string; model: string; name: string }[];
    updateSlot: (id: string, provider: string, model: string) => void;
    slotsCount: number;
}) => (
    <div className="flex items-center justify-between p-3 border-b border-border/30 bg-muted/20">
        <ModelSelector slot={slot} availableModels={availableModels} updateSlot={updateSlot} />
        <div className="flex items-center gap-1">
            {slot.response ? (
                <button
                    onClick={() => copyResponse(slot.id, slot.response?.content ?? '')}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    title={t('modelComparison.copyResponse')}
                    aria-label={t('modelComparison.copyResponse')}
                >
                    {copiedId === slot.id ? (
                        <IconCheck className="w-4 h-4 text-success" aria-hidden="true" />
                    ) : (
                        <IconCopy className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    )}
                </button>
            ) : null}
            {slotsCount > 2 && (
                <button
                    onClick={() => removeSlot(slot.id)}
                    className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                    aria-label={t('modelComparison.removeSlot')}
                >
                    <IconX className="w-4 h-4" aria-hidden="true" />
                </button>
            )}
        </div>
    </div>
);

const ResponseCardContent = ({ slot, t }: { slot: ComparisonSlot; t: (key: string) => string }) => (
    <div className="flex-1 p-4 min-h-52 max-h-96 overflow-y-auto">
        {slot.isLoading ? (
            <div
                className="flex items-center justify-center h-full"
                role="status"
                aria-label={t('modelComparison.loadingResponse')}
            >
                <IconLoader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
            </div>
        ) : slot.response?.error ? (
            <div className="text-destructive text-sm" role="alert">
                {slot.response.error}
            </div>
        ) : slot.response ? (
            <p className="text-sm whitespace-pre-wrap">{slot.response.content}</p>
        ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
                {t('modelComparison.responsePlaceholder')}
            </div>
        )}
    </div>
);

const ResponseCardStats = ({
    response,
    t,
}: {
    response: ModelResponse;
    t: (key: string) => string;
}) => (
    <div
        className="flex items-center gap-4 px-4 py-2 border-t border-border/30 bg-muted/10 typo-caption text-muted-foreground"
        aria-label={t('modelComparison.metrics')}
    >
        <span className="flex items-center gap-1" title={t('modelComparison.responseTime')}>
            <IconClock className="w-3 h-3" aria-hidden="true" />
            {(response.responseTime / 1000).toFixed(2)}s
        </span>
        <span className="flex items-center gap-1" title={t('modelComparison.tokenCount')}>
            <IconBolt className="w-3 h-3" aria-hidden="true" />
            {response.tokens} {t('modelComparison.tokensUnit')}
        </span>
        <span className="flex items-center gap-1" title={t('modelComparison.tokensPerSecond')}>
            <IconChartBar className="w-3 h-3" aria-hidden="true" />
            {(response.tokens / (response.responseTime / 1000 || 1)).toFixed(1)} {t('modelComparison.tokensPerSecondUnit')}
        </span>
    </div>
);

interface ResponseCardProps {
    slot: ComparisonSlot;
    copiedId: string | null;
    copyResponse: (id: string, content: string) => void;
    removeSlot: (id: string) => void;
    t: (key: string) => string;
    availableModels: { provider: string; model: string; name: string }[];
    updateSlot: (id: string, provider: string, model: string) => void;
    slotsCount: number;
}

const ResponseCard = (props: ResponseCardProps) => {
    const { slot } = props;
    const response = slot.response;

    return (
        <div
            className={cn(
                'flex flex-col rounded-xl border bg-card/50 overflow-hidden transition-all',
                slot.isLoading && 'animate-pulse'
            )}
            role="region"
            aria-label={`${props.t('modelComparison.responseFrom')} ${slot.model}`}
        >
            <ResponseCardHeader {...props} />
            <ResponseCardContent slot={slot} t={props.t} />
            {response && !response.error ? (
                <ResponseCardStats response={response} t={props.t} />
            ) : null}
        </div>
    );
};

const ComparisonHeader = ({ t }: { t: (key: string) => string }) => (
    <div className="mb-4">
        <h1 className="text-xl font-bold mb-1">{t('modelComparison.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('modelComparison.subtitle')}</p>
    </div>
);

const PromptInput = ({
    prompt,
    setPrompt,
    runComparison,
    isComparing,
    t,
}: {
    prompt: string;
    setPrompt: (v: string) => void;
    runComparison: () => Promise<void>;
    isComparing: boolean;
    t: (key: string) => string;
}) => (
    <div className="mb-4">
        <div className="relative">
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={t('modelComparison.promptPlaceholder')}
                aria-label={t('modelComparison.promptPlaceholder')}
                className={C_MODELCOMPARISON_2}
            />
            <div className="absolute right-2 bottom-2 flex gap-2">
                <button
                    onClick={() => void runComparison()}
                    disabled={!prompt.trim() || isComparing}
                    aria-label={t('modelComparison.compare')}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                        prompt.trim() && !isComparing
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                >
                    {isComparing ? (
                        <IconLoader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <IconPlayerPlay className="w-4 h-4" aria-hidden="true" />
                    )}
                    {t('modelComparison.compare')}
                </button>
            </div>
        </div>
    </div>
);

export const ModelComparison: React.FC<ModelComparisonProps> = ({
    availableModels,
    onCompare,
    language = 'en',
}) => {
    const { t } = useTranslation(language);
    const [prompt, setPrompt] = useState('');
    const [slots, setSlots] = useState<ComparisonSlot[]>([
        { id: '1', provider: 'openai', model: 'gpt-4o', isLoading: false },
        { id: '2', provider: 'anthropic', model: 'claude-3-sonnet', isLoading: false },
    ]);
    const [isComparing, setIsComparing] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const addSlot = useCallback(() => {
        if (slots.length >= 4) {
            return;
        }
        const unusedModel =
            availableModels.find(
                m => !slots.some(s => s.provider === m.provider && s.model === m.model)
            ) ?? availableModels[0];

        setSlots(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                provider: unusedModel.provider,
                model: unusedModel.model,
                isLoading: false,
            },
        ]);
    }, [slots, availableModels]);

    const removeSlot = useCallback(
        (id: string) => {
            if (slots.length <= 2) {
                return;
            }
            setSlots(prev => prev.filter(s => s.id !== id));
        },
        [slots]
    );

    const updateSlot = useCallback((id: string, provider: string, model: string) => {
        setSlots(prev =>
            prev.map(s => (s.id === id ? { ...s, provider, model, response: undefined } : s))
        );
    }, []);

    const runComparison = useCallback(async () => {
        if (!prompt.trim() || isComparing) {
            return;
        }

        setIsComparing(true);
        setSlots(prev => prev.map(s => ({ ...s, isLoading: true, response: undefined })));

        try {
            const models = slots.map(s => ({ provider: s.provider, model: s.model }));
            const responses = await onCompare(prompt, models);

            setSlots(prev =>
                prev.map((slot, i) => ({
                    ...slot,
                    isLoading: false,
                    response: responses[i] || undefined,
                }))
            );
        } catch (error) {
            setSlots(prev =>
                prev.map(s => ({
                    ...s,
                    isLoading: false,
                    response: {
                        model: s.model,
                        provider: s.provider,
                        content: '',
                        tokens: 0,
                        responseTime: 0,
                        timestamp: Date.now(),
                        error: String(error),
                    },
                }))
            );
        } finally {
            setIsComparing(false);
        }
    }, [prompt, slots, isComparing, onCompare]);

    const copyResponse = useCallback((id: string, content: string) => {
        void navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    return (
        <div className="h-full flex flex-col p-4">
            <ComparisonHeader t={t} />
            <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                runComparison={runComparison}
                isComparing={isComparing}
                t={t}
            />

            {/* Model Slots */}
            <div
                className="flex-1 grid gap-4"
                style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}
                role="list"
                aria-label={t('aria.comparisonSlots')}
            >
                {slots.map(slot => (
                    <ResponseCard
                        key={slot.id}
                        slot={slot}
                        copiedId={copiedId}
                        copyResponse={copyResponse}
                        removeSlot={removeSlot}
                        t={t}
                        availableModels={availableModels}
                        updateSlot={updateSlot}
                        slotsCount={slots.length}
                    />
                ))}
            </div>

            {/* Add Model Button */}
            {slots.length < 4 && (
                <button
                    onClick={addSlot}
                    aria-label={t('modelComparison.addModel')}
                    className={C_MODELCOMPARISON_3}
                >
                    <IconPlus className="w-4 h-4" aria-hidden="true" />
                    {t('modelComparison.addModel')}
                </button>
            )}
        </div>
    );
};

export default ModelComparison;
