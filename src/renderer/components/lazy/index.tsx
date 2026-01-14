import { Loader2 } from 'lucide-react'
import React, { lazy,Suspense } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useTranslation } from '@/i18n'

/**
 * Loading skeleton component with i18n support.
 */
const LoadingSpinner: React.FC<{ message?: string }> = React.memo(({ message }) => {
    const { language } = useAuth()
    const { t } = useTranslation(language || 'en')
    const loadingMessage = message || t('common.loading')
    
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
            <span className="text-sm">{loadingMessage}</span>
        </div>
    )
})

// Code editor loading skeleton
export const CodeEditorSkeleton: React.FC = React.memo(() => (
    <div className="h-full w-full bg-[#1e1e1e] rounded-lg overflow-hidden" role="status" aria-label="Loading code editor">
        <div className="h-8 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4">
            <div className="w-24 h-3 bg-[#3c3c3c] rounded animate-pulse" aria-hidden="true" />
        </div>
        <div className="p-4 space-y-2">
            {Array.from({ length: 15 }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 bg-[#2d2d2d] rounded animate-pulse"
                    style={{ width: `${(i * 17) % 40 + 40}%` }}
                    aria-hidden="true"
                />
            ))}
        </div>
    </div>
))

// Chart loading skeleton
export const ChartSkeleton: React.FC = React.memo(() => (
    <div className="h-full w-full bg-card rounded-lg p-4" role="status" aria-label="Loading chart">
        <div className="flex items-end justify-between h-full gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
                <div
                    key={i}
                    className="flex-1 bg-muted/20 rounded-t animate-pulse"
                    style={{ height: `${(i * 13) % 60 + 20}%` }}
                    aria-hidden="true"
                />
            ))}
        </div>
    </div>
))

// Import prop types for explicit casting
import type { CodeEditorProps } from '@/components/ui/CodeEditor'
import type { WorkspaceEditorProps } from '@/features/projects/components/workspace/WorkspaceEditor'
import type { SettingsPageProps } from '@/features/settings/SettingsPage'

/**
 * Creates a lazily-loaded component with proper React.Suspense wrapping.
 * 
 * Note: React.lazy has complex typing that doesn't play well with generics.
 * The implementations below use explicit typing for safety while avoiding `any`.
 */

// Pre-configured lazy components with explicit prop types
export const LazyCodeEditor: React.FC<CodeEditorProps> = (props) => {
    const Component = lazy(() => import('@/components/ui/CodeEditor').then(m => ({ default: m.CodeEditor })))
    return (
        <Suspense fallback={<CodeEditorSkeleton />}>
            <Component {...props} />
        </Suspense>
    )
}

export const LazyWorkspaceEditor: React.FC<WorkspaceEditorProps> = (props) => {
    const Component = lazy(() => import('@/features/projects/components/workspace/WorkspaceEditor').then(m => ({ default: m.WorkspaceEditor })))
    return (
        <Suspense fallback={<CodeEditorSkeleton />}>
            <Component {...props} />
        </Suspense>
    )
}

// Settings page lazy loaded
export const LazySettingsPage: React.FC<SettingsPageProps> = (props) => {
    const Component = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Component {...props} />
        </Suspense>
    )
}

export { LoadingSpinner }
