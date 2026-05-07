/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import { IconArchive, IconArchiveOff, IconCheck, IconMessageDots, IconPencil, IconSparkles, IconTrash, IconX } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/format.util';

interface WorkspaceAgentSessionModalProps {
    isOpen: boolean;
    sessions: WorkspaceAgentSessionSummary[];
    currentSessionId: string | null;
    language?: string;
    onClose: () => void;
    onSelectSession: (sessionId: string | null) => void;
    onArchiveSession: (sessionId: string, archived: boolean) => void;
    onDeleteSession: (sessionId: string) => void;
    onRenameSession: (sessionId: string, title: string) => Promise<RendererDataValue>;
    t: (key: string) => string;
}

function formatCreatedAt(createdAt: number, language: string): string {
    return formatRelativeTime(new Date(createdAt), language);
}

export const WorkspaceAgentSessionModal: React.FC<WorkspaceAgentSessionModalProps> = ({
    isOpen,
    sessions,
    currentSessionId,
    language = 'en',
    onClose,
    onSelectSession,
    onArchiveSession,
    onDeleteSession,
    onRenameSession,
    t,
}) => {
    const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
    const [draftTitle, setDraftTitle] = React.useState('');
    const sortedSessions = React.useMemo(
        () => [...sessions].sort((left, right) => right.updatedAt - left.updatedAt),
        [sessions]
    );

    const startEditing = React.useCallback((session: WorkspaceAgentSessionSummary) => {
        setEditingSessionId(session.id);
        setDraftTitle(session.title);
    }, []);

    const stopEditing = React.useCallback(() => {
        setEditingSessionId(null);
        setDraftTitle('');
    }, []);

    const submitRename = React.useCallback(async () => {
        if (!editingSessionId || !draftTitle.trim()) {
            stopEditing();
            return;
        }

        await onRenameSession(editingSessionId, draftTitle);
        stopEditing();
    }, [draftTitle, editingSessionId, onRenameSession, stopEditing]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('frontend.workspace.aiAssistant')}
            size="2xl"
        >
            <ScrollArea className="max-h-screen pr-2">
                <div className="grid gap-3">
                    {sortedSessions.map(session => (
                        <div
                            key={session.id}
                            className={cn(
                                'rounded-2xl border p-4 transition-colors',
                                session.id === currentSessionId
                                    ? 'border-info/30 bg-info/10'
                                    : 'border-border/50 bg-card/70'
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    {editingSessionId === session.id ? (
                                        <div className="space-y-2">
                                            <Input
                                                value={draftTitle}
                                                onChange={event => setDraftTitle(event.target.value)}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        void submitRename();
                                                    }
                                                    if (event.key === 'Escape') {
                                                        event.preventDefault();
                                                        stopEditing();
                                                    }
                                                }}
                                                className="h-9 rounded-xl border-border/60 bg-muted/30"
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    onClick={() => void submitRename()}
                                                    title={t('common.save')}
                                                >
                                                    <IconCheck className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={stopEditing}
                                                    title={t('common.cancel')}
                                                >
                                                    <IconX className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                onSelectSession(session.id);
                                                onClose();
                                            }}
                                            className="min-w-0 w-full text-left"
                                        >
                                            <div className="truncate text-sm font-semibold text-foreground">
                                                {session.title}
                                            </div>
                                            <div className="mt-1 typo-caption text-muted-foreground">
                                                {session.lastMessagePreview || session.strategy}
                                            </div>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            editingSessionId === session.id
                                                ? stopEditing()
                                                : startEditing(session)
                                        }
                                        title={t('common.edit')}
                                    >
                                        <IconPencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void onArchiveSession(session.id, !session.archived)}
                                        title={session.archived ? t('common.unarchive') : 'Archive'}
                                    >
                                        {session.archived ? (
                                            <IconArchiveOff className="h-4 w-4" />
                                        ) : (
                                            <IconArchive className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void onDeleteSession(session.id)}
                                        title={t('common.delete')}
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <IconTrash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <IconSparkles className="h-3.5 w-3.5" />
                                    {session.strategy}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <IconMessageDots className="h-3.5 w-3.5" />
                                    {session.messageCount}
                                </span>
                                <span>{formatCreatedAt(session.createdAt, language)}</span>
                                {session.modes.council && <span>{t('frontend.workspaceAgent.councilMode')}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Modal>
    );
};


