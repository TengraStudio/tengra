import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import { Bot,Eye, EyeOff, Search, Star } from 'lucide-react';
import React from 'react';

import type { ModelInfo } from '@/types';

interface InstalledModelsListProps {
    filtered: Array<{
        id: string;
        provider: string;
        key: string;
        sources: string[];
        details?: ModelInfo;
    }>;
    modelSearch: string;
    setModelSearch: (s: string) => void;
    showHiddenModels: boolean;
    setShowHiddenModels: (b: boolean | ((prev: boolean) => boolean)) => void;
    hiddenModels: string[];
    defaultModel: string;
    defaultProvider: string;
    setDefault: (id: string, provider: string) => void;
    updateHidden: (id: string, hide: boolean) => void;
    t: (key: string) => string;
}

export const InstalledModelsList: React.FC<InstalledModelsListProps> = ({
    filtered,
    modelSearch,
    setModelSearch,
    showHiddenModels,
    setShowHiddenModels,
    hiddenModels,
    defaultModel,
    defaultProvider,
    setDefault,
    updateHidden,
    t,
}) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col items-stretch justify-between gap-4 px-1 lg:flex-row lg:items-center">
                <div className="group relative w-full max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
                    <Input
                        type="text"
                        value={modelSearch}
                        onChange={e => setModelSearch(e.target.value)}
                        placeholder={t('workspaces.searchModels')}
                        className="h-11 rounded-2xl border-border/30 bg-background pl-12 pr-6 text-xs font-medium placeholder:text-muted-foreground/35"
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHiddenModels(prev => !prev)}
                    className="flex h-11 items-center gap-3 rounded-2xl border-border/30 bg-background px-5 text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                    {showHiddenModels ? (
                        <>
                            <EyeOff className="w-3.5 h-3.5 text-primary" />
                            {t('workspaces.hideHidden')}
                        </>
                    ) : (
                        <>
                            <Eye className="w-3.5 h-3.5" />
                            {t('workspaces.showHidden')}
                        </>
                    )}
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 xl:grid-cols-2">
                {filtered.map(model => {
                    const isDefault = defaultModel === model.id && defaultProvider === model.provider;
                    const isHidden = hiddenModels.includes(model.id);

                    return (
                        <div
                            key={model.key}
                            className={cn(
                                'group relative overflow-hidden rounded-2xl border transition-colors',
                                isDefault
                                    ? 'border-primary/25 bg-primary/5'
                                    : 'border-border/30 bg-card hover:border-border/50 hover:bg-muted/5'
                            )}
                        >
                            <div className="space-y-4 p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={cn(
                                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors',
                                                isDefault ? 'border-primary/25 bg-primary/15 text-primary' : 'border-border/20 bg-muted/20 text-muted-foreground'
                                            )}>
                                                <Bot className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-foreground">
                                                    {model.details?.name ?? model.id}
                                                </div>
                                                <div className="mt-0.5 truncate text-[10px] text-muted-foreground/60">
                                                    {model.id}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {isDefault && (
                                        <Badge className="rounded-lg border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                                            <Star className="w-2.5 h-2.5 mr-1.5 fill-current" />
                                            {t('workspaces.default')}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="h-6 rounded-lg border border-border/20 bg-muted/30 px-3 text-[10px] font-medium text-muted-foreground/70"
                                    >
                                        {model.provider}
                                    </Badge>
                                    {model.sources.map((source: string) =>
                                        source === model.provider ? null : (
                                            <Badge
                                                key={source}
                                                variant="outline"
                                                className="h-6 rounded-lg border-border/20 px-3 text-[10px] font-medium text-muted-foreground/50"
                                            >
                                                {source}
                                            </Badge>
                                        )
                                    )}
                                </div>

                                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
                                    {!isDefault ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setDefault(model.id, model.provider)}
                                            className="h-9 flex-1 rounded-xl border-primary/20 bg-primary/5 px-4 text-[10px] font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                                        >
                                            {t('workspaces.makeDefault')}
                                        </Button>
                                    ) : (
                                        <div className="flex-1" />
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateHidden(model.id, !isHidden)}
                                        className={cn(
                                            'flex h-9 items-center gap-2 rounded-xl px-4 text-[10px] font-medium transition-colors',
                                            isHidden
                                                ? 'border-success/25 bg-success/10 text-success hover:bg-success hover:text-success-foreground'
                                                : 'border-border/30 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                        )}
                                    >
                                        {isHidden ? (
                                            <>
                                                <Eye className="w-3.5 h-3.5" />
                                                {t('workspaces.show')}
                                            </>
                                        ) : (
                                            <>
                                                <EyeOff className="w-3.5 h-3.5" />
                                                {t('workspaces.hide')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
