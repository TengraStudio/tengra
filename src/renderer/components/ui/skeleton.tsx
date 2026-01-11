import { cn } from "@/lib/utils"

/**
 * Base skeleton component for loading placeholders.
 */
function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted/40", className)}
            {...props}
        />
    )
}

/**
 * Skeleton component for text lines.
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
    <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                className="h-4"
                style={{ width: i === lines - 1 ? '75%' : '100%' }}
                aria-hidden="true"
            />
        ))}
    </div>
)

/**
 * Skeleton component for cards.
 */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn('rounded-lg border bg-card p-6 space-y-4', className)} aria-label="Loading content">
        <Skeleton className="h-6 w-3/4" />
        <SkeletonText lines={3} />
    </div>
)

/**
 * Skeleton component for list items.
 */
export const SkeletonListItem: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn('flex items-center gap-4 p-4', className)} aria-label="Loading item">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
        </div>
    </div>
)

/**
 * Skeleton component for table rows.
 */
export const SkeletonTableRow: React.FC<{ columns?: number; className?: string }> = ({ columns = 4, className }) => (
    <tr className={className} aria-label="Loading table row">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="p-4">
                <Skeleton className="h-4 w-full" />
            </td>
        ))}
    </tr>
)

export { Skeleton }
