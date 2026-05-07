/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconRotate } from '@tabler/icons-react';
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
            className={cn('flex flex-col items-center justify-center gap-3 p-6 text-center animate-in fade-in zoom-in-95 duration-300', className)}
        >
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                {icon ?? <IconAlertCircle className="w-6 h-6" />}
            </div>

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                {message && (
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>
                )}
            </div>

            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border-none rounded-lg cursor-pointer transition-colors"
                >
                    <IconRotate className="w-3 h-3" />
                    {t('common.retry')}
                </button>
            )}
        </div>
    );
};

