import { AlertCircle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './error-state.css';

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
            className={cn('tengra-error-state', className)}
        >
            <div className="tengra-error-state__icon">
                {icon ?? <AlertCircle className="tengra-error-state__icon-svg" />}
            </div>

            <div className="tengra-error-state__content">
                <h3 className="tengra-error-state__title">{title}</h3>
                {message && (
                    <p className="tengra-error-state__message">{message}</p>
                )}
            </div>

            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="tengra-error-state__retry"
                >
                    <RotateCcw className="tengra-error-state__retry-icon" />
                    {t('common.retry')}
                </button>
            )}
        </div>
    );
};
