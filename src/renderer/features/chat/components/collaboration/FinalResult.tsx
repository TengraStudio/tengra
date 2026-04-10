import { CheckCircle2 } from 'lucide-react';
import { memo } from 'react';

import { Card } from '@/components/ui/card';

interface FinalResultProps {
    results: {
        consensus?: string;
        bestResponse?: {
            provider: string;
            model: string;
            content: string;
        };
    };
    t: (key: string, options?: Record<string, string | number>) => string;
}

export const FinalResult = memo(({ results, t }: FinalResultProps) => {
    if (!results.consensus && !results.bestResponse) {return null;}

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <label className="text-sm font-semibold text-muted-foreground">{t('chat.collaboration.finalResult')}</label>
            <Card className="p-4 bg-primary/5 border-primary/20 shadow-inner">
                {results.consensus && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-primary">{t('chat.collaboration.consensus')}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{results.consensus}</p>
                    </div>
                )}
                {results.bestResponse && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-primary">{t('chat.collaboration.bestResponse')}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{results.bestResponse.content}</p>
                        <p className="typo-caption text-muted-foreground pt-1 border-t border-primary/10">
                            {t('chat.collaboration.from', {
                                provider: results.bestResponse.provider,
                                model: results.bestResponse.model
                            })}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
});

FinalResult.displayName = 'FinalResult';
