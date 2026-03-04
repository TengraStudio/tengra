import { SSHTunnelManager } from '@main/services/project/ssh-tunnel-manager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SSHTunnelManager', () => {
    let manager: SSHTunnelManager;

    beforeEach(() => {
        manager = new SSHTunnelManager('/tmp/ssh-tunnel-tests');
    });

    it('should create and close remote forwards with options objects', async () => {
        const conn = {
            forwardIn: vi.fn((_host: string, _port: number, callback: (error?: Error) => void) => callback()),
            unforwardIn: vi.fn((_host: string, _port: number, callback: () => void) => callback())
        };

        const created = await manager.createRemoteForward({
            connectionId: 'conn-1',
            conn: conn as never,
            remoteHost: '0.0.0.0',
            remotePort: 9000,
            localHost: '127.0.0.1',
            localPort: 3000
        });

        expect(created.success).toBe(true);
        expect(created.forwardId).toBeDefined();
        expect(manager.getAllPortForwards()).toHaveLength(1);

        const closed = await manager.closePortForward(created.forwardId ?? '');

        expect(closed).toBe(true);
        expect(conn.unforwardIn).toHaveBeenCalledWith('0.0.0.0', 9000, expect.any(Function));
        expect(manager.getAllPortForwards()).toEqual([]);
    });

    it('should dispose all tracked forwards', async () => {
        const conn = {
            forwardIn: vi.fn((_host: string, _port: number, callback: (error?: Error) => void) => callback()),
            unforwardIn: vi.fn((_host: string, _port: number, callback: () => void) => callback())
        };

        await manager.createRemoteForward({
            connectionId: 'conn-1',
            conn: conn as never,
            remoteHost: '0.0.0.0',
            remotePort: 9001,
            localHost: '127.0.0.1',
            localPort: 3001
        });

        await manager.createRemoteForward({
            connectionId: 'conn-1',
            conn: conn as never,
            remoteHost: '0.0.0.0',
            remotePort: 9002,
            localHost: '127.0.0.1',
            localPort: 3002
        });

        await manager.dispose();

        expect(conn.unforwardIn).toHaveBeenCalledTimes(2);
        expect(manager.getAllPortForwards()).toEqual([]);
    });
});
