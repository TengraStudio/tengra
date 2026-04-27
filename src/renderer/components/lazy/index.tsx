/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLoader2 } from '@tabler/icons-react';
import * as React from 'react';
import { lazy, Suspense } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';

/**
 * Loading skeleton component with i18n support.
 */
const LoadingSpinner: React.FC<{ message?: string }> = React.memo(({ message }) => {
    const { language } = useAuth();
    const { t } = useTranslation(language);
    const loadingMessage = message ?? t('common.loading');

    return (
        <div
            className="flex flex-col items-center justify-center h-full min-h-52 gap-3 text-muted-foreground"
            role="status"
            aria-live="polite"
        >
            <IconLoader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
            <span className="text-sm">{loadingMessage}</span>
        </div>
    );
});
LoadingSpinner.displayName = 'LoadingSpinner';

// Code editor loading skeleton
export const CodeEditorSkeleton: React.FC = React.memo(() => {
    const { t } = useTranslation();
    return (
        <div
            className="h-full w-full bg-card rounded-lg overflow-hidden"
            role="status"
            aria-label={t('loading.codeEditor')}
        >
            <div className="h-8 bg-muted border-b border-border flex items-center px-4">
                <div className="w-24 h-3 bg-muted rounded animate-pulse" aria-hidden="true" />
            </div>
            <div className="p-4 space-y-2">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-4 bg-muted rounded animate-pulse"
                        style={{ width: `${((i * 17) % 40) + 40}%` }}
                        aria-hidden="true"
                    />
                ))}
            </div>
        </div>
    );
});
CodeEditorSkeleton.displayName = 'CodeEditorSkeleton';

// Chart loading skeleton
export const ChartSkeleton: React.FC = React.memo(() => {
    const { t } = useTranslation();
    return (
        <div
            className="h-full w-full bg-card rounded-lg p-4"
            role="status"
            aria-label={t('loading.chart')}
        >
            <div className="flex items-end justify-between h-full gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-muted/20 rounded-t animate-pulse"
                        style={{ height: `${((i * 13) % 60) + 20}%` }}
                        aria-hidden="true"
                    />
                ))}
            </div>
        </div>
    );
});
ChartSkeleton.displayName = 'ChartSkeleton';

// Import prop types for explicit casting
import type { CodeEditorProps } from '@/components/ui/CodeEditor';
import type { SettingsPageProps } from '@/features/settings/SettingsPage';
import type { WorkspaceEditorProps } from '@/features/workspace/components/workspace/WorkspaceEditor';

/**
 * Creates a lazily-loaded component with proper React.Suspense wrapping.
 *
 * Note: React.lazy has complex typing that doesn't play well with generics.
 * The implementations below use explicit typing for safety while avoiding `any`.
 */

// Lazy-loaded module references created at module scope to prevent remounting on re-render
const CodeEditorLazy = lazy(() =>
    import('@/components/ui/CodeEditor').then(m => ({ default: m.CodeEditor }))
);

const WorkspaceEditorLazy = lazy(() =>
    import('@/features/workspace/components/workspace/WorkspaceEditor').then(m => ({
        default: m.WorkspaceEditor,
    }))
);

const SettingsPageLazy = lazy(() =>
    import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))
);

// Pre-configured lazy components with explicit prop types
export const LazyCodeEditor: React.FC<CodeEditorProps> = props => (
    <Suspense fallback={<CodeEditorSkeleton />}>
        <CodeEditorLazy {...props} />
    </Suspense>
);

export const LazyWorkspaceEditor: React.FC<WorkspaceEditorProps> = props => (
    <Suspense fallback={<CodeEditorSkeleton />}>
        <WorkspaceEditorLazy {...props} />
    </Suspense>
);

// Settings page lazy loaded
export const LazySettingsPage: React.FC<SettingsPageProps> = props => (
    <Suspense fallback={<LoadingSpinner />}>
        <SettingsPageLazy {...props} />
    </Suspense>
);

export { LoadingSpinner };
