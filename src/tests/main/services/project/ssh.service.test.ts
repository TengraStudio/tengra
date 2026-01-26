import * as fs from 'fs';

import { SSHConnection } from '@main/services/project/ssh.service';
import { SSHService } from '@main/services/project/ssh.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        writeFile: vi.fn().mockResolvedValue(undefined)
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
        service = new SSHService(storagePath);
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
                password: 'secret-password',
                connected: false
            };

            const success = await service.saveProfile(profile);
            expect(success).toBe(true);
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('ssh-profiles.json'),
                expect.stringContaining('secret-password')
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
    });

    describe('Security & readLogFile', () => {
        let executeSpy: any;

        beforeEach(() => {
            // Use spyOn to better track calls
            executeSpy = vi.spyOn(service, 'executeCommand').mockResolvedValue({ stdout: 'log content', stderr: '', code: 0 });
            // Mock connection existence check
            service['connections'].set('test-id', {} as unknown as any);
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
                .toThrow('Access denied');
        });

        it('should throw error for paths not starting with /var/log', async () => {
            await expect(service.readLogFile('test-id', '/etc/passwd'))
                .rejects
                .toThrow('Access denied');
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
                if (cmd.includes('uptime')) { return Promise.resolve({ stdout: 'up 1 day', stderr: '', code: 0 }); }
                if (cmd.includes('free -m')) { return Promise.resolve({ stdout: 'total used free\nMem: 2048 1024 512', stderr: '', code: 0 }); }
                if (cmd.includes('Cpu(s)')) { return Promise.resolve({ stdout: 'Cpu(s): 10.0 us', stderr: '', code: 0 }); }
                if (cmd.includes('df -h /')) { return Promise.resolve({ stdout: 'Filesystem Size Used Avail Use%\n/dev/sda1 10G 5G 5G 50%', stderr: '', code: 0 }); }
                return Promise.resolve({ stdout: '', stderr: '', code: 0 });
            });

            const stats = await service.getSystemStats('test-id');
            expect(stats.uptime).toBe('up 1 day');
            expect(stats.memory.percent).toBe(50);
            expect(stats.cpu).toBe(10);
        });
    });
});
