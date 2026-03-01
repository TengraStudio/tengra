import { type MutableRefObject,useCallback } from 'react';
import { z } from 'zod';

import { invokeTypedIpc } from '@/lib/ipc-client';

import type { TerminalIpcContract } from '../utils/terminal-ipc';

interface UseTerminalInputBroadcastParams {
    activeTabIdRef: MutableRefObject<string | null>;
    isSynchronizedInputEnabled: boolean;
    splitView: { primaryId: string; secondaryId: string } | null;
}

export function useTerminalInputBroadcast({
    activeTabIdRef,
    isSynchronizedInputEnabled,
    splitView,
}: UseTerminalInputBroadcastParams) {
    const resolveInputTargetSessionIds = useCallback((): string[] => {
        const activeId = activeTabIdRef.current;
        if (!activeId) {
            return [];
        }

        if (!isSynchronizedInputEnabled || !splitView) {
            return [activeId];
        }

        const targets = new Set<string>([activeId]);
        if (splitView.primaryId === activeId && splitView.secondaryId) {
            targets.add(splitView.secondaryId);
        } else if (splitView.secondaryId === activeId && splitView.primaryId) {
            targets.add(splitView.primaryId);
        }
        return Array.from(targets);
    }, [activeTabIdRef, isSynchronizedInputEnabled, splitView]);

    const writeInputToTargetSessions = useCallback(
        async (value: string) => {
            const targets = resolveInputTargetSessionIds();
            if (targets.length === 0 || !value) {
                return;
            }
            await Promise.all(
                targets.map(sessionId =>
                    invokeTypedIpc<TerminalIpcContract, 'terminal:write'>(
                        'terminal:write',
                        [sessionId, value],
                        { responseSchema: z.boolean() }
                    )
                )
            );
        },
        [resolveInputTargetSessionIds]
    );

    const writeCommandToActiveTerminal = useCallback(
        async (command: string) => {
            if (!command) {
                return;
            }
            await writeInputToTargetSessions(`${command}\r`);
        },
        [writeInputToTargetSessions]
    );

    return {
        resolveInputTargetSessionIds,
        writeInputToTargetSessions,
        writeCommandToActiveTerminal,
    };
}
