import { IdeaSession } from '@shared/types/ideas';
import React from 'react';

import { cn } from '@/lib/utils';

interface SessionInfoProps {
    session: IdeaSession
    ideasCount: number
    t: (key: string) => string
}

export const SessionInfo: React.FC<SessionInfoProps> = ({ session, ideasCount, t }) => (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-4 flex items-center justify-between mb-6">
        <div>
            <p className="text-sm text-foreground/50">{session.categories.join(', ')}</p>
            <p className="text-xs text-foreground/30 mt-1">{ideasCount} ideas generated</p>
        </div>
        <span
            className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                session.status === 'completed'
                    ? 'bg-success/20 text-success'
                    : 'bg-white/10 text-foreground/60'
            )}
        >
            {t(`ideas.status.${session.status}`)}
        </span>
    </div>
);
