import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: <T>(str: string, fallback: T): T => {
        try { return JSON.parse(str) as T; } catch { return fallback; }
    }
}));

import { DockerService } from '@main/services/workspace/docker.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { CommandService } from '@main/services/system/command.service';

interface MockCommandService {
    executeCommand: ReturnType<typeof vi.fn>;
}

interface MockSSHService {
    executeCommand: ReturnType<typeof vi.fn>;
}

describe('DockerService', () => {
    let service: DockerService;
    let mockCommand: MockCommandService;
    let mockSSH: MockSSHService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCommand = { executeCommand: vi.fn() };
        mockSSH = { executeCommand: vi.fn() };
        service = new DockerService(
            mockCommand as unknown as CommandService,
            mockSSH as unknown as SSHService
        );
    });

    describe('listContainers', () => {
        it('should list containers locally', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true,
                stdout: '{"ID":"abc","Names":"web"}\n{"ID":"def","Names":"db"}',
                stderr: ''
            });
            const result = await service.listContainers();
            expect(result.success).toBe(true);
            expect((result as { success: boolean; containers: unknown[] }).containers).toHaveLength(2);
        });

        it('should pass -a flag when all=true', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: '', stderr: ''
            });
            await service.listContainers(true);
            expect(mockCommand.executeCommand).toHaveBeenCalledWith(
                expect.stringContaining('-a')
            );
        });

        it('should return error on command failure', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: false, stdout: '', stderr: 'docker not found'
            });
            const result = await service.listContainers();
            expect(result.success).toBe(false);
        });

        it('should use SSH when connectionId provided', async () => {
            mockSSH.executeCommand.mockResolvedValue({
                code: 0,
                stdout: '{"ID":"remote"}',
                stderr: ''
            });
            const result = await service.listContainers(false, 'conn-1');
            expect(result.success).toBe(true);
            expect(mockSSH.executeCommand).toHaveBeenCalledWith('conn-1', expect.any(String));
        });
    });

    describe('manageContainer', () => {
        it('should start a container', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: 'abc', stderr: ''
            });
            const result = await service.manageContainer('abc', 'start');
            expect(result.success).toBe(true);
            expect(mockCommand.executeCommand).toHaveBeenCalledWith('docker start abc');
        });

        it('should remove a container with -f flag', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: '', stderr: ''
            });
            await service.manageContainer('abc', 'remove');
            expect(mockCommand.executeCommand).toHaveBeenCalledWith('docker rm -f abc');
        });

        it('should restart a container', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: '', stderr: ''
            });
            await service.manageContainer('abc', 'restart');
            expect(mockCommand.executeCommand).toHaveBeenCalledWith('docker restart abc');
        });
    });

    describe('getLogs', () => {
        it('should get container logs with default tail', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: 'log line 1\nlog line 2', stderr: ''
            });
            const result = await service.getLogs('abc');
            expect(result.success).toBe(true);
            expect(mockCommand.executeCommand).toHaveBeenCalledWith('docker logs --tail 50 abc');
        });

        it('should use custom tail count', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true, stdout: '', stderr: ''
            });
            await service.getLogs('abc', 100);
            expect(mockCommand.executeCommand).toHaveBeenCalledWith('docker logs --tail 100 abc');
        });
    });

    describe('getStats', () => {
        it('should parse stats output', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true,
                stdout: '{"Container":"abc","CPUPerc":"0.5%"}',
                stderr: ''
            });
            const result = await service.getStats();
            expect(result.success).toBe(true);
            expect((result as { success: boolean; stats: unknown[] }).stats).toHaveLength(1);
        });

        it('should handle command failure', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: false, stdout: '', stderr: 'error'
            });
            const result = await service.getStats();
            expect(result.success).toBe(false);
        });
    });

    describe('listImages', () => {
        it('should parse images output', async () => {
            mockCommand.executeCommand.mockResolvedValue({
                success: true,
                stdout: '{"Repository":"node","Tag":"18"}',
                stderr: ''
            });
            const result = await service.listImages();
            expect(result.success).toBe(true);
            expect((result as { success: boolean; images: unknown[] }).images).toHaveLength(1);
        });

        it('should handle SSH connection', async () => {
            mockSSH.executeCommand.mockResolvedValue({
                code: 0,
                stdout: '{"Repository":"nginx","Tag":"latest"}',
                stderr: ''
            });
            const result = await service.listImages('conn-2');
            expect(result.success).toBe(true);
            expect(mockSSH.executeCommand).toHaveBeenCalled();
        });
    });
});
