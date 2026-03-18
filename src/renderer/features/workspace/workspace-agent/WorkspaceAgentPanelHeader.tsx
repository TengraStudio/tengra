import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import {
    Archive,
    Clock3,
    FolderKanban,
    Layers3,
    MoreHorizontal,
    Plus,
    Shield,
} from 'lucide-react';
import React from 'react';

import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WorkspaceAgentPanelHeaderProps {
    recentSessions: WorkspaceAgentSessionSummary[];
    currentSession: WorkspaceAgentSessionSummary | null;
    onSelectSession: (sessionId: string | null) => void;
    onArchiveSession: (sessionId: string, archived: boolean) => void;
    onOpenSessionPicker: () => void;
    onCreateSession: () => void;
    t: (key: string) => string;
}

function formatTokens(value: number | undefined): string {
    if (!value) {
        return '0';
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}k`;
    }
    return `${Math.round(value)}`;
}

function formatHandoffTime(timestamp: number | undefined): string | null {
    if (!timestamp) {
        return null;
    }
    return new Date(timestamp).toLocaleTimeString();
}

function getPermissionTone(session: WorkspaceAgentSessionSummary): string {
    if (
        session.permissionPolicy.commandPolicy === 'full-access' ||
        session.permissionPolicy.pathPolicy === 'restricted-off-dangerous'
    ) {
        return 'text-red-300 border-red-500/30 bg-red-500/10';
    }
    if (session.permissionPolicy.commandPolicy === 'ask-every-time') {
        return 'text-amber-200 border-amber-400/25 bg-amber-400/10';
    }
    return 'text-emerald-200 border-emerald-500/25 bg-emerald-500/10';
}

function SessionModes({
    councilLabel,
    session,
    t,
}: {
    councilLabel: string;
    session: WorkspaceAgentSessionSummary;
    t: (key: string) => string;
}): JSX.Element {
    if (session.modes.council) {
        return (
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-fuchsia-500/20 bg-fuchsia-500/10">
                    {councilLabel}
                </Badge>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {session.modes.ask && <Badge variant="outline" className="border-white/10 bg-white/5">{t('common.ai')}</Badge>}
            {session.modes.plan && <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10">{t('workspaceAgent.planAction')}</Badge>}
            {session.modes.agent && <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10">{t('input.agent')}</Badge>}
        </div>
    );
}

function SessionCard({
    onArchive,
    session,
    onClick,
    archiveTitle,
}: {
    onArchive: () => void;
    session: WorkspaceAgentSessionSummary;
    onClick: () => void;
    archiveTitle: string;
}): JSX.Element {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-all hover:border-white/15 hover:bg-white/[0.04]">
            <div className="min-w-0">
                <button onClick={onClick} className="w-full min-w-0 text-left">
                    <div className="truncate text-sm font-semibold text-foreground">
                        {session.title}
                    </div>
                </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                <span>{new Date(session.updatedAt).toLocaleString()}</span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onArchive}
                title={archiveTitle}
            >
                <Archive className="h-4 w-4" />
            </Button>
        </div>
    );
}

function SessionArchiveAction({
    onArchive,
    title,
}: {
    onArchive: () => void;
    title: string;
}): JSX.Element {
    return (
        <Button variant="ghost" size="icon" onClick={onArchive} title={title}>
            <Archive className="h-4 w-4" />
        </Button>
    );
}

export const WorkspaceAgentPanelHeader: React.FC<WorkspaceAgentPanelHeaderProps> = ({
    recentSessions,
    currentSession,
    onSelectSession,
    onArchiveSession,
    onOpenSessionPicker,
    onCreateSession,
    t,
}) => {
    if (!currentSession) {
        return (
            <div className="border-b border-white/8 bg-black/40 p-4">
                <div className="flex items-center justify-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon" onClick={onCreateSession} title={t('common.add')}>
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onOpenSessionPicker} title={t('common.more')}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="mt-3 grid gap-2">
                    {recentSessions.map(session => (
                        <SessionCard
                            key={session.id}
                            session={session}
                            onClick={() => onSelectSession(session.id)}
                            onArchive={() => onArchiveSession(session.id, !session.archived)}
                            archiveTitle={
                                session.archived ? t('common.unarchive') : t('memory.archive')
                            }
                        />
                    ))}
                </div>
            </div>
        );
    }

    const telemetry = currentSession.contextTelemetry;
    const handoffTime = formatHandoffTime(telemetry?.lastHandoffAt);

    return (
        <div className="border-b border-white/8 bg-black/40 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-200">
                            <FolderKanban className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-foreground">
                                {currentSession.title}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                <span>{telemetry?.provider ?? 'workspace'}</span>
                                <span>{telemetry?.model ?? 'session'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <SessionArchiveAction
                        onArchive={() => onArchiveSession(currentSession.id, true)}
                        title={t('memory.archive')}
                    />
                    <Button variant="ghost" size="icon" onClick={() => onSelectSession(null)} title={t('common.back')}>
                        <Layers3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onOpenSessionPicker} title={t('common.more')}>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatTokens(telemetry?.usedTokens)} / {formatTokens(telemetry?.contextWindow)}</span>
                    <span>{formatTokens(telemetry?.remainingTokens)}</span>
                </div>
                <AnimatedProgressBar
                    className="mt-2"
                    value={telemetry?.usedTokens ?? 0}
                    max={Math.max(1, telemetry?.contextWindow ?? 1)}
                    size="sm"
                    variant={telemetry?.pressureState === 'high' ? 'error' : 'gradient'}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SessionModes councilLabel={t('agents.council')} session={currentSession} t={t} />
                    <Badge variant="outline" className={cn('rounded-full border px-2 py-1 text-[11px]', getPermissionTone(currentSession))}>
                        <Shield className="mr-1 h-3 w-3" />
                        {currentSession.permissionPolicy.commandPolicy}
                    </Badge>
                    {telemetry && (
                        <Badge
                            variant="outline"
                            className={cn(
                                'rounded-full border px-2 py-1 text-[11px]',
                                telemetry.pressureState === 'high'
                                    ? 'border-red-500/25 bg-red-500/10 text-red-200'
                                    : telemetry.pressureState === 'medium'
                                        ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
                                        : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
                            )}
                        >
                            {telemetry.pressureState} · {Math.round(telemetry.usagePercent)}%
                        </Badge>
                    )}
                    {telemetry?.handoffCount ? (
                        <Badge variant="outline" className="rounded-full border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100">
                            {telemetry.handoffCount}x · {telemetry.lastHandoffLabel ?? telemetry.model}
                            {handoffTime ? ` · ${handoffTime}` : ''}
                        </Badge>
                    ) : null}
                    {currentSession.background && (
                        <Badge variant="outline" className="rounded-full border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">
                            {t('common.pending')}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
};
