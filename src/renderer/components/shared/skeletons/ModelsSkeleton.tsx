import React from 'react';

import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/** Skeleton placeholder for the Models page layout */
export const ModelsSkeleton: React.FC = React.memo(() => (
    <div className="h-full w-full p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
            <Skeleton variant="rounded" width={200} height={36} />
            <Skeleton variant="rounded" width={120} height={36} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton variant="circular" width={40} height={40} />
                        <div className="flex-1 space-y-2">
                            <Skeleton variant="text" width="60%" height={18} />
                            <Skeleton variant="text" width="40%" height={14} />
                        </div>
                    </div>
                    <SkeletonText lines={2} />
                    <div className="flex gap-2">
                        <Skeleton variant="rounded" width={64} height={24} />
                        <Skeleton variant="rounded" width={64} height={24} />
                    </div>
                </div>
            ))}
        </div>
    </div>
));

ModelsSkeleton.displayName = 'ModelsSkeleton';
