/**
 * Multi-Model Collaboration Component
 * Allows users to run multiple LLMs simultaneously and compare/combine results
 */

import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';

import { ResponsiveContainer } from '@/components/responsive/ResponsiveContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { Message } from '@/types';

interface MultiModelCollaborationProps {
    messages: Message[]
    onResult?: (result: string) => void
    availableModels?: Array<{ provider: string; model: string; label: string }>
}

type Strategy = 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought'

interface ModelResponse {
    provider: string
    model: string
    content: string
    latency: number
}

interface CollaborationResult {
    response?: string
    responses: ModelResponse[]
    consensus?: string
    bestResponse?: {
        provider: string
        model: string
        content: string
    }
}

interface ModelItemProps {
    model: { provider: string; model: string }
    onRemove: () => void
    disabled: boolean
}

const ModelItem: React.FC<ModelItemProps & { t: (key: string) => string }> = ({ model, onRemove, disabled, t }) => (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
        <span className="flex-1 text-sm">{model.provider}/{model.model}</span>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
            {t('chat.collaboration.remove')}
        </Button>
    </div>
);

interface ResponseCardProps {
    response: ModelResponse
}

const ResponseCard: React.FC<ResponseCardProps> = ({ response }) => (
    <Card className="p-3">
        <div className="flex items-start justify-between mb-2">
            <span className="text-sm font-medium">{response.provider}/{response.model}</span>
            <span className="text-xs text-muted-foreground">{response.latency}ms</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">{response.content}</p>
    </Card>
);

interface FinalResultProps {
    results: CollaborationResult
}

const FinalResult: React.FC<FinalResultProps & { t: (key: string, options?: Record<string, string | number>) => string }> = ({ results, t }) => {
    if (!results.consensus && !results.bestResponse) { return null; }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('chat.collaboration.finalResult')}</label>
            <Card className="p-4 bg-primary/5">
                {results.consensus && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('chat.collaboration.consensus')}</span>
                        </div>
                        <p className="text-sm">{results.consensus}</p>
                    </div>
                )}
                {results.bestResponse && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{t('chat.collaboration.bestResponse')}</span>
                        </div>
                        <p className="text-sm mb-2">{results.bestResponse.content}</p>
                        <p className="text-xs text-muted-foreground">
                            {t('chat.collaboration.from', { provider: results.bestResponse.provider, model: results.bestResponse.model })}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export function MultiModelCollaboration({
    messages,
    onResult,
    availableModels = []
}: MultiModelCollaborationProps) {
    const { t } = useTranslation();
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [strategy, setStrategy] = useState<Strategy>('consensus');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<CollaborationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAddModel = () => {
        if (availableModels.length > 0) {
            const firstModel = availableModels[0];
            setSelectedModels([...selectedModels, {
                provider: firstModel.provider,
                model: firstModel.model
            }]);
        }
    };

    const handleRemoveModel = (index: number) => {
        setSelectedModels(selectedModels.filter((_, i) => i !== index));
    };

    const handleRun = async () => {
        if (selectedModels.length === 0) {
            setError(t('chat.collaboration.selectModelError'));
            return;
        }

        setIsRunning(true);
        setError(null);
        setResults(null);

        try {
            const result = await window.electron.collaboration.run({
                messages,
                models: selectedModels,
                strategy
            });

            setResults(result);
            // Use the main response field from the result
            if (result.response) {
                onResult?.(result.response);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('chat.collaboration.runFailed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <ResponsiveContainer className="w-full space-y-4">
            <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">{t('chat.collaboration.title')}</h3>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('chat.collaboration.selectedModels')}</label>
                    {selectedModels.map((model, index) => (
                        <ModelItem
                            key={index}
                            model={model}
                            onRemove={() => handleRemoveModel(index)}
                            disabled={isRunning}
                            t={t}
                        />
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddModel}
                        disabled={isRunning || availableModels.length === 0}
                    >
                        {t('chat.collaboration.addModel')}
                    </Button>
                </div>

                {/* Strategy Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">{t('chat.collaboration.strategy')}</label>
                    <Select
                        value={strategy}
                        onValueChange={(value) => setStrategy(value as Strategy)}
                        disabled={isRunning}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="consensus">{t('chat.collaboration.strategyConsensus')}</SelectItem>
                            <SelectItem value="vote">{t('chat.collaboration.strategyVote')}</SelectItem>
                            <SelectItem value="best-of-n">{t('chat.collaboration.strategyBestOfN')}</SelectItem>
                            <SelectItem value="chain-of-thought">{t('chat.collaboration.strategyChain')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Run Button */}
                <Button
                    onClick={() => { void (async () => { await handleRun(); })(); }}
                    disabled={isRunning || selectedModels.length === 0}
                    className="w-full"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('chat.collaboration.running')}
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {t('chat.collaboration.run')}
                        </>
                    )}
                </Button>

                {/* Error Display */}
                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">{error}</span>
                    </div>
                )}

                {/* Results Display */}
                {results && (
                    <div className="space-y-4 mt-4 pt-4 border-t">
                        <h4 className="font-semibold">{t('chat.collaboration.results')}</h4>
                        
                        {/* Individual Responses */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('chat.collaboration.individualResponses')}</label>
                            {results.responses.map((response, index: number) => (
                                <ResponseCard key={index} response={response} />
                            ))}
                        </div>

                        {/* Consensus/Best Response */}
                        <FinalResult results={results} t={t} />
                    </div>
                )}
            </Card>
        </ResponsiveContainer>
    );
}
