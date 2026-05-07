/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type MutableRefObject,useCallback } from 'react';

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
                targets.map(sessionId => window.electron.terminal.write(sessionId, value))
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

