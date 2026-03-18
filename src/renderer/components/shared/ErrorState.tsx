import { AlertCircle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/** Props for the ErrorState component */
interface ErrorStateProps {
    /** Error title displayed prominently */
    title: string;
    /** Optional descriptive message shown below the title */
    message?: string;
    /** Optional retry callback; renders a retry button when provided */
    onRetry?: () => void;
    /** Optional custom icon replacing the default AlertCircle */
    icon?: ReactNode;
    /** Optional additional CSS classes for the root container */
    className?: string;
}

/**
 * Reusable inline error state component for displaying errors within content areas.
 * Provides a consistent error layout with icon, title, message, and optional retry.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
    title,
    message,
    onRetry,
    icon,
    className,
}) => {
    const { t } = useTranslation();

    return (
        <div
            role="alert"
            className={cn(
                'flex flex-col items-center justify-center gap-3 p-6 text-center',
                className,
            )}
        >
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                {icon ?? <AlertCircle className="h-6 w-6" />}
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                {message && (
                    <p className="text-xs text-muted-foreground max-w-sm">{message}</p>
                )}
            </div>

            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                    <RotateCcw className="h-3 w-3" />
                    {t('common.retry')}
                </button>
            )}
        </div>
    );
};
