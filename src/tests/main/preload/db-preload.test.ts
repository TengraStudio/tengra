/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('electron', () => ({
    ipcRenderer: {
        invoke: (...args: TestValue[]) => mockInvoke(...args),
    },
}));

import { createDbBridge } from '@main/preload/domains/db.preload';
import { ipcRenderer } from 'electron';

describe('Db preload bridge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockResolvedValue({ success: true });
    });

    it('forwards updateMessage as positional arguments', async () => {
        const bridge = createDbBridge(ipcRenderer);

        await bridge.updateMessage('msg-1', { content: 'hello' });

        expect(mockInvoke).toHaveBeenCalledWith('db:updateMessage', 'msg-1', { content: 'hello' });
    });

    it('forwards updateWorkspace and archiveWorkspace with handler-compatible arguments', async () => {
        const bridge = createDbBridge(ipcRenderer);
        const workspaceResponse = {
            id: 'ws-1',
            title: 'Updated',
            description: 'desc',
            path: 'C:\\workspace',
            mounts: [],
            chatIds: [],
            councilConfig: {
                enabled: false,
                members: [],
                consensusThreshold: 0.7,
            },
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        mockInvoke
            .mockResolvedValueOnce(workspaceResponse)
            .mockResolvedValueOnce({ success: true });

        const updatedWorkspace = await bridge.updateWorkspace('ws-1', { title: 'Updated' });
        await bridge.archiveWorkspace('ws-1', true);

        expect(updatedWorkspace).toEqual(workspaceResponse);
        expect(mockInvoke).toHaveBeenNthCalledWith(1, 'db:updateWorkspace', 'ws-1', { title: 'Updated' });
        expect(mockInvoke).toHaveBeenNthCalledWith(2, 'db:archiveWorkspace', 'ws-1', true);
    });

    it('forwards deleteWorkspace with the deleteFiles flag', async () => {
        const bridge = createDbBridge(ipcRenderer);

        await bridge.deleteWorkspace('ws-1', true);

        expect(mockInvoke).toHaveBeenCalledWith('db:deleteWorkspace', 'ws-1', true);
    });
});
