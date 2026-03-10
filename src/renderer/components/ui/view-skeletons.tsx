import React from 'react';

import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/skeleton';

export type ViewSkeletonId =
    | 'chat'
    | 'workspace'
    | 'settings'
    | 'mcp'
    | 'memory'
    | 'ideas'
    | 'agent'
    | 'automation-workflow'
    | 'models'
    | 'docker'
    | 'terminal';

export const ChatViewSkeleton: React.FC = () => (
    <div className="h-full w-full p-4 md:p-6 flex flex-col gap-4">
        <div className="space-y-3">
            <Skeleton variant="rounded" height={56} />
            <SkeletonText lines={2} />
        </div>
        <div className="flex-1 space-y-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="max-w-[90%]">
                    <Skeleton variant="rounded" height={idx % 2 === 0 ? 64 : 88} />
                </div>
            ))}
        </div>
        <div className="border border-border/50 rounded-xl p-3 space-y-2">
            <Skeleton variant="rounded" height={40} />
            <div className="flex gap-2">
                <Skeleton variant="rounded" width={88} height={28} />
                <Skeleton variant="rounded" width={88} height={28} />
            </div>
        </div>
    </div>
);

export const WorkspaceViewSkeleton: React.FC = () => (
    <div className="h-full w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-3">
            <Skeleton variant="rounded" height={44} />
            {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} variant="rounded" height={38} />
            ))}
        </div>
        <div className="space-y-4">
            <Skeleton variant="rounded" height={52} />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <SkeletonCard key={idx} />
                ))}
            </div>
        </div>
    </div>
);

export const SettingsViewSkeleton: React.FC = () => (
    <div className="h-full w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="space-y-2">
            <Skeleton variant="rounded" height={42} />
            {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton key={idx} variant="rounded" height={34} />
            ))}
        </div>
        <div className="space-y-4">
            <Skeleton variant="rounded" height={56} />
            <SkeletonCard />
            <SkeletonCard showImage={false} />
            <SkeletonCard showImage={false} />
        </div>
    </div>
);

export const GenericViewSkeleton: React.FC = () => (
    <div className="h-full w-full p-4 md:p-6 space-y-4">
        <Skeleton variant="rounded" height={48} />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard showImage={false} />
    </div>
);

export function renderViewSkeleton(view: ViewSkeletonId): React.ReactElement {
    switch (view) {
        case 'chat':
            return <ChatViewSkeleton />;
        case 'workspace':
            return <WorkspaceViewSkeleton />;
        case 'settings':
            return <SettingsViewSkeleton />;
        default:
            return <GenericViewSkeleton />;
    }
}
