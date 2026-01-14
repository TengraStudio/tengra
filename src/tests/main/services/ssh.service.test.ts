import { SSHService } from '@main/services/ssh.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('electron', () => ({
    safeStorage: {
        isEncryptionAvailable: () => false
    },
    app: {
        getPath: () => '/tmp'
    }
}))

vi.mock('ssh2', () => ({
    Client: vi.fn(),
    ClientChannel: vi.fn()
}))

describe('SSHService Security', () => {
    let service: SSHService

    beforeEach(() => {
        service = new SSHService('/tmp/ssh-storage')
        // Mock executeCommand to avoid real SSH connection requirement
        service.executeCommand = vi.fn().mockResolvedValue({ stdout: 'log content', stderr: '', code: 0 })
        // Mock connection existence check
        service['connections'].set('test-id', {} as any)
    })

    describe('readLogFile', () => {
        it('should allow access to valid log files', async () => {
            await service.readLogFile('test-id', '/var/log/syslog')
            expect(service.executeCommand).toHaveBeenCalledWith(
                'test-id',
                expect.stringContaining("'/var/log/syslog'")
            )
        })

        it('should normalize paths to prevent traversal', async () => {
            // Should be normalized to /var/log/syslog
            await service.readLogFile('test-id', '/var/log/subdir/../syslog')
            expect(service.executeCommand).toHaveBeenCalledWith(
                'test-id',
                expect.stringContaining("'/var/log/syslog'")
            )
        })

        it('should throw error for path traversal attempting to escape /var/log', async () => {
            await expect(service.readLogFile('test-id', '/var/log/../../etc/passwd'))
                .rejects
                .toThrow('Access denied')
        })

        it('should throw error for paths not starting with /var/log', async () => {
            await expect(service.readLogFile('test-id', '/etc/passwd'))
                .rejects
                .toThrow('Access denied')
        })

        it('should quote the path to prevent shell injection', async () => {
            const maliciousPath = "/var/log/syslog; rm -rf /"
            await service.readLogFile('test-id', maliciousPath)

            // The command should contain the path wrapped in single quotes
            // and the single quotes in the path should be escaped
            // '/var/log/syslog; rm -rf /'
            expect(service.executeCommand).toHaveBeenCalledWith(
                'test-id',
                expect.stringMatching(/tail -n 50 '.+'/)
            )

            // Verify the specific quoting structure for the malicious input
            // The service replaces ' with '"'"' -> '/var/log/syslog; rm -rf /' should be passed as literally that invalid path (which will fail in tail but safe from shell injection) (wait catched by normalized path but let's see if pure injection works)

            // Valid directory attack vector:
            const injectionAttempt = "/var/log/'$(whoami)'"
            await service.readLogFile('test-id', injectionAttempt)
            expect(service.executeCommand).toHaveBeenCalledWith(
                'test-id',
                expect.stringContaining("'\"'\"'$(whoami)'\"'\"'")
            )
        })
    })
})
