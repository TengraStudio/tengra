import React from 'react';

import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

/** Skeleton placeholder for the Workspaces page layout */
export const WorkspacesSkeleton: React.FC = React.memo(() => (
    <div className="h-full w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3">
            <Skeleton variant="rounded" height={44} />
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={38} />
            ))}
        </div>
        <div className="space-y-4">
            <Skeleton variant="rounded" height={52} />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    </div>
));

WorkspacesSkeleton.displayName = 'WorkspacesSkeleton';
