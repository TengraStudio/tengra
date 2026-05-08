/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';

import { SSHConnection } from '@main/services/workspace/ssh.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

// Mock dependencies
vi.mock('electron', () => ({
    safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (s: string) => Buffer.from(s),
        decryptString: (b: Buffer) => b.toString()
    },
    app: {
        getPath: () => '/tmp'
    }
}));

vi.mock('ssh2', () => ({
    Client: vi.fn().mockImplementation(() => ({
        on: vi.fn().mockReturnThis(),
        connect: vi.fn(),
        end: vi.fn(),
        exec: vi.fn(),
        forwardOut: vi.fn((_srcHost, _srcPort, _dstHost, _dstPort, callback) => callback(undefined, {
            pipe: vi.fn().mockReturnThis()
        })),
        forwardIn: vi.fn((_host, _port, callback) => callback(undefined)),
        unforwardIn: vi.fn((_host, _port, callback) => callback()),
        sftp: vi.fn(),
        shell: vi.fn()
    })),
    ClientChannel: vi.fn()
}));

vi.mock('fs', () => ({
    promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue('[]'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        appendFile: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('SSHService', () => {
    let service: SSHService;
    const storagePath = '/tmp/ssh-storage';

    beforeEach(() => {
        vi.clearAllMocks();
        const mockSecurityService = {
            encryptSync: vi.fn((val: string) => val),
            decryptSync: vi.fn((val: string) => val),
        } as any;
        service = new SSHService(storagePath, mockSecurityService, () => null);
    });

    describe('Profile Management', () => {
        it('should get saved profiles', async () => {
            const profiles = await service.getSavedProfiles();
            expect(profiles).toEqual([]);
            expect(fs.promises.readFile).toHaveBeenCalled();
        });

        it('should save a profile with encryption', async () => {
            const profile: SSHConnection = {
                id: 'test-id',
                name: 'Test',
                host: 'localhost',
                port: 22,
                username: 'user',
                authType: 'password' as const,
                password: 'mock-secret-password',
                connected: false
            };

            const success = await service.saveProfile(profile);
            expect(success).toBe(true);
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-profiles.json'),
                expect.stringContaining('mock-secret-password')
            );
        });

        it('should delete a profile', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify([{ id: 'test-id' }]));
            const success = await service.deleteProfile('test-id');
            expect(success).toBe(true);
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-profiles.json'),
                '[]'
            );
        });

        it('returns diagnostics when connection key cannot be loaded', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('ENOENT: missing key'));
            const result = await service.connect({
                id: 'diag-1',
                name: 'Diag',
                host: 'localhost',
                port: 22,
                username: 'user',
                authType: 'key',
                privateKey: '/tmp/missing-key',
                connected: false
            });

            expect(result.success).toBe(false);
            expect(result.diagnostics?.category).toBe('key');
            expect(result.diagnostics?.hint).toContain('SSH key');
        });
    });

    describe('SSH key management', () => {
        it('should generate managed key metadata', async () => {
            const result = await service.generateManagedKey('My Key', 'mock-secret-passphrase');
            expect(result.key.name).toBe('My Key');
            expect(result.key.algorithm).toBe('ed25519');
            expect(result.key.hasPassphrase).toBe(true);
            expect(result.privateKey).toContain('PRIVATE KEY');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-keys.json'),
                expect.any(String)
            );
        });

        it('should import and list managed keys', async () => {
            const generated = await service.generateManagedKey('Generated Key');
            vi.mocked(fs.promises.readFile).mockImplementation(async (filePath) => {
                if (String(filePath).includes('ssh-keys.json')) {
                    const imported = {
                        id: 'imported-id',
                        name: 'Imported Key',
                        algorithm: 'ed25519',
                        publicKey: generated.publicKey,
                        fingerprint: 'SHA256:test',
                        privateKey: generated.privateKey,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        rotationCount: 0
                    };
                    return JSON.stringify([imported]);
                }
                return '[]';
            });
            const keys = await service.listManagedKeys();
            expect(keys).toHaveLength(1);
            expect(keys[0].name).toBe('Imported Key');
        });

        it('should manage known hosts entries', async () => {
            vi.mocked(fs.promises.readFile).mockImplementation(async (filePath) => {
                if (String(filePath).includes('known_hosts')) {
                    return 'example.com ssh-ed25519 AAAATESTKEY\n';
                }
                return '[]';
            });
            const hosts = await service.listKnownHosts();
            expect(hosts).toEqual([{ host: 'example.com', keyType: 'ssh-ed25519', publicKey: 'AAAATESTKEY' }]);

            const added = await service.addKnownHost({
                host: 'host2.example.com',
                keyType: 'ssh-ed25519',
                publicKey: 'AAAATESTKEY2'
            });
            expect(added).toBe(true);
            expect(fs.promises.appendFile).toHaveBeenCalled();

            const removed = await service.removeKnownHost('example.com', 'ssh-ed25519');
            expect(removed).toBe(true);
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('known_hosts'),
                expect.any(String)
            );
        });
    });

    describe('Tunnel support', () => {
        it('should create and close remote tunnel', async () => {
            const mockConn = {
                forwardIn: vi.fn((_host: string, _port: number, cb: (error?: Error) => void) => cb(undefined)),
                unforwardIn: vi.fn((_host: string, _port: number, cb: () => void) => cb())
            };
            service['connections'].set('conn-id', mockConn as never as never);
            const created = await service.createRemoteForward('conn-id', '0.0.0.0', 2222, '127.0.0.1', 22);
            expect(created.success).toBe(true);
            expect(created.forwardId).toBeDefined();
            const closed = await service.closePortForward(created.forwardId ?? '');
            expect(closed).toBe(true);
            expect(mockConn.unforwardIn).toHaveBeenCalled();
        });

        it('should save and list tunnel presets', async () => {
            const preset = await service.saveTunnelPreset({
                name: 'Web Tunnel',
                type: 'local',
                localHost: '127.0.0.1',
                localPort: 8080,
                remoteHost: '127.0.0.1',
                remotePort: 80
            });
            expect(preset.name).toBe('Web Tunnel');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-tunnel-presets.json'),
                expect.any(String)
            );
        });

        it('should dispose and close all active tunnels', async () => {
            const mockConn = {
                forwardIn: vi.fn((_host: string, _port: number, cb: (error?: Error) => void) => cb(undefined)),
                unforwardIn: vi.fn((_host: string, _port: number, cb: () => void) => cb()),
                end: vi.fn()
            };
            service['connections'].set('conn-id', mockConn as never);

            const first = await service.createRemoteForward('conn-id', '0.0.0.0', 2201, '127.0.0.1', 22);
            const second = await service.createRemoteForward('conn-id', '0.0.0.0', 2202, '127.0.0.1', 22);

            await service.dispose();

            expect(first.success).toBe(true);
            expect(second.success).toBe(true);
            expect(mockConn.unforwardIn).toHaveBeenCalledTimes(2);
            expect(service.getPortForwards()).toEqual([]);
        });
    });

    describe('SSH roadmap advanced features', () => {
        it('caches remote directory metadata for repeated explorer reads', async () => {
            const readdir = vi.fn((_path: string, callback: (error: Error | undefined, list: Array<{
                filename: string;
                longname: string;
                attrs: { size: number; mtime: number; isDirectory: () => boolean };
            }>) => void) => callback(undefined, [
                {
                    filename: 'src',
                    longname: 'drwxr-xr-x',
                    attrs: {
                        size: 0,
                        mtime: 123,
                        isDirectory: () => true,
                    },
                },
            ]));
            const mockConn = {
                sftp: vi.fn((callback: (error: Error | undefined, sftp: { readdir: typeof readdir }) => void) =>
                    callback(undefined, { readdir }))
            };

            service['connections'].set('conn-id', mockConn as never);

            const first = await service.listDirectory('conn-id', '/home/demo');
            const second = await service.listDirectory('conn-id', '/home/demo');

            expect(first.success).toBe(true);
            expect(second.success).toBe(true);
            expect(readdir).toHaveBeenCalledTimes(1);
        });

        it('returns stale remote metadata immediately and lazily hydrates the cache', async () => {
            const readdir = vi
                .fn()
                .mockImplementationOnce((_path: string, callback: (error: Error | undefined, list: Array<{
                    filename: string;
                    longname: string;
                    attrs: { size: number; mtime: number; isDirectory: () => boolean };
                }>) => void) =>
                    callback(undefined, [
                        {
                            filename: 'src',
                            longname: 'drwxr-xr-x',
                            attrs: {
                                size: 0,
                                mtime: 123,
                                isDirectory: () => true,
                            },
                        },
                    ]))
                .mockImplementationOnce((_path: string, callback: (error: Error | undefined, list: Array<{
                    filename: string;
                    longname: string;
                    attrs: { size: number; mtime: number; isDirectory: () => boolean };
                }>) => void) =>
                    callback(undefined, [
                        {
                            filename: 'docs',
                            longname: 'drwxr-xr-x',
                            attrs: {
                                size: 0,
                                mtime: 456,
                                isDirectory: () => true,
                            },
                        },
                    ]));
            const mockConn = {
                sftp: vi.fn((callback: (error: Error | undefined, sftp: { readdir: typeof readdir }) => void) =>
                    callback(undefined, { readdir }))
            };

            service['connections'].set('conn-id', mockConn as never);

            const first = await service.listDirectory('conn-id', '/home/demo');
            service['directoryMetadataCache'].set('conn-id:/home/demo', {
                files: first.files ?? [],
                cachedAt: Date.now() - 6_000,
            });

            const stale = await service.listDirectory('conn-id', '/home/demo');

            expect(first.files?.[0]?.name).toBe('src');
            expect(stale.files?.[0]?.name).toBe('src');
            expect(readdir).toHaveBeenCalledTimes(2);
        });

        it('invalidates remote directory cache after mutating file operations', async () => {
            const readdir = vi
                .fn()
                .mockImplementation((_path: string, callback: (error: Error | undefined, list: Array<{
                    filename: string;
                    longname: string;
                    attrs: { size: number; mtime: number; isDirectory: () => boolean };
                }>) => void) =>
                    callback(undefined, [
                        {
                            filename: 'src',
                            longname: 'drwxr-xr-x',
                            attrs: {
                                size: 0,
                                mtime: 123,
                                isDirectory: () => true,
                            },
                        },
                    ]));
            const mkdir = vi.fn((_path: string, callback: (error?: Error) => void) => callback());
            const mockConn = {
                sftp: vi.fn((callback: (error: Error | undefined, sftp: {
                    readdir: typeof readdir;
                    mkdir: typeof mkdir;
                }) => void) =>
                    callback(undefined, { readdir, mkdir }))
            };

            service['connections'].set('conn-id', mockConn as never);

            await service.listDirectory('conn-id', '/home/demo');
            await service.listDirectory('conn-id', '/home/demo');
            await service.createDirectory('conn-id', '/home/demo/new-dir');
            await service.listDirectory('conn-id', '/home/demo');

            expect(readdir).toHaveBeenCalledTimes(2);
            expect(mkdir).toHaveBeenCalledTimes(1);
        });

        it('should search remote files and persist search history', async () => {
            service.executeCommand = vi.fn().mockResolvedValue({
                stdout: '/home/user/file-a.txt\n/home/user/file-b.txt',
                stderr: '',
                code: 0
            });
            const results = await service.searchRemoteFiles('conn-id', 'file', { path: '/home/user', limit: 2 });
            expect(results).toHaveLength(2);
            expect(results[0].path).toContain('/home/user');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-search-history.json'),
                expect.any(String)
            );
        });

        it('should reconnect and expose pool stats', async () => {
            vi.spyOn(service, 'connect').mockResolvedValue({ success: true });
            service['connectionDetails'].set('conn-id', {
                id: 'conn-id',
                name: 'Test',
                host: 'localhost',
                port: 22,
                username: 'user',
                authType: 'password',
                connected: false
            });
            const reconnectResult = await service.reconnectConnection('conn-id');
            expect(reconnectResult.success).toBe(true);
            await service.acquireConnection('conn-id');
            const stats = service.getConnectionPoolStats();
            expect(stats[0].connectionId).toBe('conn-id');
            await service.releaseConnection('conn-id');
        });

        it('should run transfer batch and return results', async () => {
            vi.spyOn(service, 'uploadFile').mockResolvedValue(true);
            vi.spyOn(service, 'downloadFile').mockResolvedValue(true);
            const results = await service.runTransferBatch([
                { id: '1', connectionId: 'conn-id', direction: 'upload', localPath: 'a', remotePath: '/tmp/a' },
                { id: '2', connectionId: 'conn-id', direction: 'download', localPath: 'b', remotePath: '/tmp/b' }
            ]);
            expect(results).toEqual([true, true]);
        });

        it('should parse remote containers list', async () => {
            service.executeCommand = vi.fn().mockResolvedValue({
                stdout: 'abc123|node:20|Up 1 hour|dev-node',
                stderr: '',
                code: 0
            });
            const containers = await service.listRemoteContainers('conn-id');
            expect(containers[0]).toMatchObject({ id: 'abc123', image: 'node:20' });
        });

        it('should save profile template and validate profile', async () => {
            const template = await service.saveProfileTemplate({
                name: 'Default Ubuntu',
                username: 'ubuntu',
                port: 22
            });
            expect(template.name).toBe('Default Ubuntu');
            const validation = service.validateProfile({ host: '', username: '', port: 70000 });
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it('should handle session recording lifecycle', () => {
            const started = service.startSessionRecording('conn-id');
            expect(started.connectionId).toBe('conn-id');
            started.chunks.push('first line');
            const search = service.searchSessionRecording('conn-id', 'first');
            expect(search).toEqual(['first line']);
            const exported = service.exportSessionRecording('conn-id');
            expect(exported).toContain('first line');
            const stopped = service.stopSessionRecording('conn-id');
            expect(stopped?.endedAt).toBeDefined();
        });
    });

    describe('Security & readLogFile', () => {
        let executeSpy: MockInstance;

        beforeEach(() => {
            // Use spyOn to better track calls
            executeSpy = vi.spyOn(service, 'executeCommand').mockResolvedValue({ stdout: 'log content', stderr: '', code: 0, success: true });
            // Mock connection existence check
            service['connections'].set('test-id', {} as never);
        });

        it('should allow access to valid log files', async () => {
            await service.readLogFile('test-id', '/var/log/syslog');
            expect(executeSpy).toHaveBeenCalledWith(
                'test-id',
                "tail -n 50 '/var/log/syslog'"
            );
        });

        it('should normalize paths to prevent traversal', async () => {
            await service.readLogFile('test-id', '/var/log/subdir/../syslog');
            expect(executeSpy).toHaveBeenCalledWith(
                'test-id',
                "tail -n 50 '/var/log/syslog'"
            );
        });

        it('should throw error for path traversal attempting to escape /var/log', async () => {
            await expect(service.readLogFile('test-id', '/var/log/../../etc/passwd'))
                .rejects
                .toThrow('error.ssh.path_must_be_within_var_log');
        });

        it('should throw error for paths not starting with /var/log', async () => {
            await expect(service.readLogFile('test-id', '/etc/passwd'))
                .rejects
                .toThrow('error.ssh.path_must_be_within_var_log');
        });

        it('should quote the path to prevent shell injection', async () => {
            const maliciousPath = "/var/log/syslog; rm -rf /";
            await service.readLogFile('test-id', maliciousPath);
            // It should be wrapped in single quotes: '/var/log/syslog; rm -rf /'
            expect(executeSpy).toHaveBeenCalledWith(
                'test-id',
                expect.stringContaining("'/var/log/syslog; rm -rf /'")
            );
        });
    });

    describe('System Stats', () => {
        it('should parse system stats correctly', async () => {
            service.executeCommand = vi.fn().mockImplementation((_id, cmd) => {
                if (cmd.includes('uptime')) { return Promise.resolve({ stdout: 'up 1 day', stderr: '', code: 0, success: true }); }
                if (cmd.includes('free -m')) { return Promise.resolve({ stdout: 'total used free\nMem: 2048 1024 512', stderr: '', code: 0, success: true }); }
                if (cmd.includes('Cpu(s)')) { return Promise.resolve({ stdout: 'Cpu(s): 10.0 us', stderr: '', code: 0, success: true }); }
                if (cmd.includes('df -h /')) { return Promise.resolve({ stdout: 'Filesystem Size Used Avail Use%\n/dev/sda1 10G 5G 5G 50%', stderr: '', code: 0, success: true }); }
                return Promise.resolve({ stdout: 'v1.0.0', stderr: '', code: 0, success: true });
            });

            const stats = await service.getSystemStats('test-id');
            expect(stats.uptime).toBe('up 1 day');
            expect(stats.memory.percent).toBe(50);
            expect(stats.cpu).toBe(10);
        });
    });
});

