import React from 'react';

import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/skeleton';

/** Skeleton placeholder for the Settings page layout */
export const SettingsSkeleton: React.FC = React.memo(() => (
    <div className="h-full w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
            <Skeleton variant="rounded" height={42} />
            {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={34} />
            ))}
        </div>
        <div className="space-y-4">
            <Skeleton variant="rounded" height={56} />
            <SkeletonCard />
            <SkeletonCard showImage={false} />
            <div className="border border-border rounded-xl p-4 space-y-3">
                <Skeleton variant="text" width="40%" height={20} />
                <SkeletonText lines={3} />
            </div>
        </div>
    </div>
));

SettingsSkeleton.displayName = 'SettingsSkeleton';
