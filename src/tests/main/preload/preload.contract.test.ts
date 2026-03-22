import { createAuthBridge } from '@main/preload/domains/auth.preload';
import { createWindowControlsBridge } from '@main/preload/domains/window-controls.preload';
import { describe, expect, it, vi } from 'vitest';

const createIpcRendererMock = () => ({
    send: vi.fn(),
    invoke: vi.fn().mockResolvedValue({ success: true }),
});

describe('Preload contract regression', () => {
    it('maps window controls to expected IPC channels', () => {
        const ipc = createIpcRendererMock();
        const bridge = createWindowControlsBridge(ipc as never);

        bridge.minimize();
        bridge.maximize();
        bridge.close();
        bridge.toggleCompact(true);
        bridge.resizeWindow('1920x1080');
        void bridge.getZoomFactor();
        void bridge.setZoomFactor(1.1);
        void bridge.stepZoomFactor(1);
        void bridge.resetZoomFactor();

        expect(ipc.send).toHaveBeenCalledWith('window:minimize');
        expect(ipc.send).toHaveBeenCalledWith('window:maximize');
        expect(ipc.send).toHaveBeenCalledWith('window:close');
        expect(ipc.send).toHaveBeenCalledWith('window:toggle-compact', true);
        expect(ipc.send).toHaveBeenCalledWith('window:resize', '1920x1080');
        expect(ipc.invoke).toHaveBeenCalledWith('window:get-zoom-factor');
        expect(ipc.invoke).toHaveBeenCalledWith('window:set-zoom-factor', 1.1);
        expect(ipc.invoke).toHaveBeenCalledWith('window:step-zoom-factor', 1);
        expect(ipc.invoke).toHaveBeenCalledWith('window:reset-zoom-factor');
    });

    it('maps auth bridge methods to expected IPC channels', async () => {
        const ipc = createIpcRendererMock();
        const bridge = createAuthBridge(ipc as never);

        await bridge.githubLogin('profile');
        await bridge.pollToken('device', 5, 'copilot');

        expect(ipc.invoke).toHaveBeenCalledWith('auth:github-login', 'profile');
        expect(ipc.invoke).toHaveBeenCalledWith('auth:poll-token', 'device', 5, 'copilot');
    });
});
