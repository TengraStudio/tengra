import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import {
    Archive,
    ArchiveRestore,
    Check,
    MessageSquareDot,
    PencilLine,
    Sparkles,
    X,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface WorkspaceAgentSessionModalProps {
    isOpen: boolean;
    sessions: WorkspaceAgentSessionSummary[];
    currentSessionId: string | null;
    onClose: () => void;
    onSelectSession: (sessionId: string | null) => void;
    onArchiveSession: (sessionId: string, archived: boolean) => void;
    onRenameSession: (sessionId: string, title: string) => Promise<RendererDataValue>;
    t: (key: string) => string;
}

function formatUpdatedAt(updatedAt: number): string {
    return new Date(updatedAt).toLocaleString();
}

export const WorkspaceAgentSessionModal: React.FC<WorkspaceAgentSessionModalProps> = ({
    isOpen,
    sessions,
    currentSessionId,
    onClose,
    onSelectSession,
    onArchiveSession,
    onRenameSession,
    t,
}) => {
    const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
    const [draftTitle, setDraftTitle] = React.useState('');

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
            title={t('workspace.aiAssistant')}
            size="2xl"
        >
            <ScrollArea className="max-h-screen pr-2">
                <div className="grid gap-3">
                    {sessions.map(session => (
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
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={stopEditing}
                                                    title={t('common.cancel')}
                                                >
                                                    <X className="h-4 w-4" />
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
                                            <div className="mt-1 text-xs text-muted-foreground">
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
                                        <PencilLine className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void onArchiveSession(session.id, !session.archived)}
                                        title={session.archived ? t('common.unarchive') : t('common.delete')}
                                    >
                                        {session.archived ? (
                                            <ArchiveRestore className="h-4 w-4" />
                                        ) : (
                                            <Archive className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xxs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {session.strategy}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <MessageSquareDot className="h-3.5 w-3.5" />
                                    {session.messageCount}
                                </span>
                                <span>{formatUpdatedAt(session.updatedAt)}</span>
                                {session.modes.council && <span>{t('workspaceAgent.councilMode')}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Modal>
    );
};

