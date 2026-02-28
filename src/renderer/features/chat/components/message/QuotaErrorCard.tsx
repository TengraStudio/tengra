import { memo } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface QuotaErrorCardProps {
    details: { message: string; resets_at: number | null; model: string | null };
    t: TranslationFn;
}

/**
 * QuotaErrorCard component
 * 
 * Displays an error message when the AI model quota is exceeded.
 */
export const QuotaErrorCard = memo(({ details, t }: QuotaErrorCardProps) => (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-destructive/10 to-warning/10 border border-destructive/20 text-destructive max-w-md animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-destructive/20">
                <AlertCircle className="w-5 h-5" />
            </div>
            <div>
                <div className="font-bold text-sm uppercase tracking-tight">
                    {t('messageBubble.quotaExceeded')}
                </div>
                {details.model && (
                    <div className="text-xs opacity-70 mt-0.5">{details.model}</div>
                )}
            </div>
        </div>
        <p className="text-sm opacity-90 leading-relaxed mb-3">{details.message}</p>
        {details.resets_at && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/10 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>
                    {t('messageBubble.resetsAt')}{' '}
                    {new Date(details.resets_at * 1000).toLocaleString()}
                </span>
            </div>
        )}
    </div>
));

QuotaErrorCard.displayName = 'QuotaErrorCard';
