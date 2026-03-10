import { NetworkService } from '@main/services/system/network.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('@shared/utils/error.util', () => ({
    getErrorMessage: (e: Error) => e?.message ?? 'unknown'
}));

const mockSpawnChild = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn()
};

vi.mock('child_process', () => ({
    spawn: vi.fn(() => mockSpawnChild)
}));

vi.mock('net', () => {
    const mockSocket = {
        setTimeout: vi.fn(),
        on: vi.fn(),
        connect: vi.fn(),
        destroy: vi.fn()
    };
    return { Socket: vi.fn(() => mockSocket) };
});

vi.mock('os', () => ({
    networkInterfaces: vi.fn().mockReturnValue({ eth0: [{ address: '192.168.1.1' }] })
}));

vi.mock('ws', () => ({
    WebSocketServer: vi.fn(class MockWebSocketServer {
        public on = vi.fn();
    })
}));

describe('NetworkService', () => {
    let service: NetworkService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new NetworkService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ping', () => {
        it('should reject invalid host', async () => {
            const result = await service.ping('invalid host!@#');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid hostname or IP address');
        });

        it('should call spawn with valid host', async () => {
            // Simulate successful close
            mockSpawnChild.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'close') {cb(0);}
            });
            mockSpawnChild.stdout.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'data') {cb('Reply from 8.8.8.8');}
            });
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.ping('8.8.8.8');
            expect(result.success).toBe(true);
        });
    });

    describe('whois', () => {
        it('should reject invalid domain', async () => {
            const result = await service.whois('invalid domain!');
            expect(result.success).toBe(false);
        });
    });

    describe('traceroute', () => {
        it('should reject invalid host', async () => {
            const result = await service.traceroute('bad host!!');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid hostname or IP address');
        });
    });

    describe('scanPort', () => {
        it('should reject invalid host', async () => {
            const result = await service.scanPort('bad host!!', 80);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid host');
        });
    });

    describe('getNetworkInterfaces', () => {
        it('should return network interfaces', async () => {
            const result = await service.getNetworkInterfaces();
            expect(result.success).toBe(true);
        });
    });

    describe('getPublicIP', () => {
        it('should handle fetch failure', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
            const result = await service.getPublicIP();
            expect(result.success).toBe(false);
            vi.unstubAllGlobals();
        });

        it('should return IP on success', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                json: () => Promise.resolve({ ip: '1.2.3.4' })
            }));
            const result = await service.getPublicIP();
            expect(result.success).toBe(true);
            expect(result.result?.ip).toBe('1.2.3.4');
            vi.unstubAllGlobals();
        });
    });

    describe('startWebSocketServer', () => {
        it('should return a result object', () => {
            const result = service.startWebSocketServer(9999);
            expect(result).toHaveProperty('success');
        });
    });

    describe('whois with valid domain', () => {
        it('should call spawn for valid domain', async () => {
            mockSpawnChild.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'close') {cb(0);}
            });
            mockSpawnChild.stdout.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'data') {cb('Domain Name: example.com');}
            });
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.whois('example.com');
            expect(result.success).toBe(true);
        });
    });

    describe('traceroute with valid host', () => {
        it('should call spawn for valid host', async () => {
            mockSpawnChild.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'close') {cb(0);}
            });
            mockSpawnChild.stdout.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'data') {cb('1  router  1ms');}
            });
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.traceroute('8.8.8.8');
            expect(result.success).toBe(true);
            expect(result.result?.output).toContain('router');
        });
    });

    describe('ping error handling', () => {
        it('should handle spawn error', async () => {
            mockSpawnChild.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'error') {cb(new Error('spawn failed'));}
            });
            mockSpawnChild.stdout.on.mockImplementation(() => {});
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.ping('8.8.8.8');
            expect(result.success).toBe(false);
        });
    });

    describe('host validation edge cases', () => {
        it('should reject empty string', async () => {
            const result = await service.ping('');
            expect(result.success).toBe(false);
        });

        it('should accept valid IP address', async () => {
            mockSpawnChild.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'close') {cb(0);}
            });
            mockSpawnChild.stdout.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
                if (event === 'data') {cb('ok');}
            });
            mockSpawnChild.stderr.on.mockImplementation(() => {});

            const result = await service.ping('192.168.1.1');
            expect(result.success).toBe(true);
        });
    });
});
