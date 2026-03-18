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

        await bridge.updateWorkspace('ws-1', { title: 'Updated' });
        await bridge.archiveWorkspace('ws-1', true);

        expect(mockInvoke).toHaveBeenNthCalledWith(1, 'db:updateWorkspace', 'ws-1', { title: 'Updated' });
        expect(mockInvoke).toHaveBeenNthCalledWith(2, 'db:archiveWorkspace', 'ws-1', true);
    });
});
