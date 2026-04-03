import { AlertCircle, RotateCcw } from 'lucide-react';
import { memo } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface ToolRecoveryNoticeProps {
    interruptedToolNames: string[];
    onRegenerate?: () => void;
    t: TranslationFn;
}

export const ToolRecoveryNotice = memo(
    ({ interruptedToolNames, onRegenerate, t }: ToolRecoveryNoticeProps) => {
        if (interruptedToolNames.length === 0) {
            return null;
        }

        return (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <div className="flex min-w-0 items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                        {t('tools.failed')}: {interruptedToolNames.join(', ')}
                    </span>
                </div>
                {onRegenerate && (
                    <button
                        type="button"
                        onClick={onRegenerate}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 px-2 py-1 font-semibold transition-colors hover:bg-warning/10"
                        aria-label={t('messageBubble.regenerate')}
                        title={t('messageBubble.regenerate')}
                    >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t('messageBubble.regenerate')}</span>
                    </button>
                )}
            </div>
        );
    }
);

ToolRecoveryNotice.displayName = 'ToolRecoveryNotice';
