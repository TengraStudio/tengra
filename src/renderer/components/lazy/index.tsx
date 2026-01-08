import React, { Suspense, lazy, ComponentType } from 'react'
import { Loader2 } from 'lucide-react'

// Loading skeleton component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">{message}</span>
    </div>
)

// Code editor loading skeleton
export const CodeEditorSkeleton: React.FC = () => (
    <div className="h-full w-full bg-[#1e1e1e] rounded-lg overflow-hidden">
        <div className="h-8 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4">
            <div className="w-24 h-3 bg-[#3c3c3c] rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
            {Array.from({ length: 15 }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 bg-[#2d2d2d] rounded animate-pulse"
                    style={{ width: `${Math.random() * 40 + 40}%` }}
                />
            ))}
        </div>
    </div>
)

// Chart loading skeleton
export const ChartSkeleton: React.FC = () => (
    <div className="h-full w-full bg-card rounded-lg p-4">
        <div className="flex items-end justify-between h-full gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
                <div
                    key={i}
                    className="flex-1 bg-muted/20 rounded-t animate-pulse"
                    style={{ height: `${Math.random() * 60 + 20}%` }}
                />
            ))}
        </div>
    </div>
)

// Generic lazy loading wrapper
export function withLazyLoading<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    FallbackComponent: React.FC = LoadingSpinner
): React.FC<React.ComponentProps<T>> {
    const LazyComponent = lazy(importFn)

    return (props: React.ComponentProps<T>) => (
        <Suspense fallback={<FallbackComponent />}>
            <LazyComponent {...props} />
        </Suspense>
    )
}

// Pre-configured lazy components
export const LazyCodeEditor = withLazyLoading(
    () => import('@/components/ui/CodeEditor').then(m => ({ default: m.CodeEditor })),
    CodeEditorSkeleton
)

export const LazyWorkspaceEditor = withLazyLoading(
    () => import('@/features/projects/components/workspace/WorkspaceEditor').then(m => ({ default: m.WorkspaceEditor })),
    CodeEditorSkeleton
)

// Settings page lazy loaded
export const LazySettingsPage = withLazyLoading(
    () => import('@/features/settings/SettingsPage'),
    LoadingSpinner
)

// Gallery lazy loaded
export const LazyGalleryView = withLazyLoading(
    () => import('@/features/chat/components/GalleryView').then(m => ({ default: m.GalleryView })),
    LoadingSpinner
)

export { LoadingSpinner }
