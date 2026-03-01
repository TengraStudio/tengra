/**
 * Sub-section components for MultiModelCollaboration
 */

import { Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ModelItem } from './ModelItem';
import { ChangeAnnotation, CursorMarker, Strategy } from './types';

type TranslationFn = (key: string) => string;

interface ModelSelectionSectionProps {
    selectedModels: Array<{ provider: string; model: string }>
    isRunning: boolean
    onAddModel: () => void
    onRemoveModel: (index: number) => void
    availableModelsCount: number
    t: TranslationFn
}

export const ModelSelectionSection = memo(({
    selectedModels, isRunning, onAddModel, onRemoveModel, availableModelsCount, t
}: ModelSelectionSectionProps) => {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('chat.collaboration.selectedModels')}</label>
            {selectedModels.map((model, index) => (
                <ModelItem key={index} model={model} onRemove={() => onRemoveModel(index)} disabled={isRunning} t={t} />
            ))}
            <Button variant="outline" size="sm" onClick={onAddModel} disabled={isRunning || availableModelsCount === 0}>
                {t('chat.collaboration.addModel')}
            </Button>
        </div>
    );
});

interface StrategySectionProps {
    strategy: Strategy
    onStrategyChange: (value: string) => void
    isRunning: boolean
    t: TranslationFn
}

export const StrategySection = memo(({ strategy, onStrategyChange, isRunning, t }: StrategySectionProps) => {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('chat.collaboration.strategy')}</label>
            <Select value={strategy} onValueChange={onStrategyChange} disabled={isRunning}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="consensus">{t('chat.collaboration.strategyConsensus')}</SelectItem>
                    <SelectItem value="vote">{t('chat.collaboration.strategyVote')}</SelectItem>
                    <SelectItem value="best-of-n">{t('chat.collaboration.strategyBestOfN')}</SelectItem>
                    <SelectItem value="chain-of-thought">{t('chat.collaboration.strategyChain')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
});

interface ActivitySectionProps {
    cursorMarkers: CursorMarker[]
    annotations: ChangeAnnotation[]
    onAddMarker: () => void
    onAddAnnotation: () => void
    t: TranslationFn
}

export const ActivitySection = memo(({
    cursorMarkers, annotations, onAddMarker, onAddAnnotation, t
}: ActivitySectionProps) => {
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{t('chat.collaboration.cursorMarkers')}</label>
                    <Button size="sm" variant="outline" onClick={onAddMarker}>{t('chat.collaboration.addMarker')}</Button>
                </div>
                {cursorMarkers.map((marker) => (
                    <p key={marker.id} className="text-xs text-muted-foreground">{marker.user} → {marker.target}</p>
                ))}
            </Card>
            <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{t('chat.collaboration.changeAnnotations')}</label>
                    <Button size="sm" variant="outline" onClick={onAddAnnotation}>{t('chat.collaboration.annotate')}</Button>
                </div>
                {annotations.map((annotation) => (
                    <p key={annotation.id} className="text-xs text-muted-foreground">{annotation.author}: {annotation.note}</p>
                ))}
            </Card>
        </div>
    );
});

interface RunButtonProps {
    isRunning: boolean
    disabled: boolean
    onClick: () => void
    t: TranslationFn
}

export const RunButton = memo(({ isRunning, disabled, onClick, t }: RunButtonProps) => {
    return (
        <Button onClick={onClick} disabled={isRunning || disabled} className="w-full">
            {isRunning ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('chat.collaboration.running')}</>
            ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{t('chat.collaboration.run')}</>
            )}
        </Button>
    );
});

interface ErrorDisplayProps {
    error: string
    isRunning: boolean
    disabled: boolean
    onRetry: () => void
    onDismiss: () => void
    t: TranslationFn
}

export const ErrorDisplay = memo(({ error, isRunning, disabled, onRetry, onDismiss, t }: ErrorDisplayProps) => {
    return (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md space-y-2">
            <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive flex-1">{error}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onRetry} disabled={isRunning || disabled}>
                    <RefreshCw className="w-3 h-3 mr-1" />{t('chat.collaboration.retry')}
                </Button>
                <Button variant="ghost" size="sm" onClick={onDismiss}>{t('chat.collaboration.dismiss')}</Button>
            </div>
        </div>
    );
});
