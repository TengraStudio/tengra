/**
 * Unit tests for SecurityService
 */
import { SecurityService } from '@main/services/security/security.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron safeStorage
vi.mock('electron', () => ({
    safeStorage: {
        isEncryptionAvailable: vi.fn().mockReturnValue(true),
        encryptString: vi.fn().mockImplementation((text: string) => Buffer.from(`encrypted:${text}`)),
        decryptString: vi.fn().mockImplementation((buffer: Buffer) => {
            const str = buffer.toString();
            if (str.startsWith('encrypted:')) {
                return str.replace('encrypted:', '');
            }
            throw new Error('Invalid encrypted data');
        })
    }
}));

// Mock fs and fs/promises
vi.mock('fs', async () => {
    return {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        statSync: vi.fn().mockReturnValue({ size: 0 }),
        promises: {
            access: vi.fn().mockResolvedValue(undefined),
            copyFile: vi.fn().mockResolvedValue(undefined),
            readFile: vi.fn(),
            unlink: vi.fn(),
            writeFile: vi.fn().mockResolvedValue(undefined)
        }
    };
});

// Mock fs/promises alias if needed, but the above might cover import * as fs
vi.mock('fs/promises', () => ({
    copyFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    unlink: vi.fn()
}));

let service: SecurityService;
let fsMock: any;

beforeEach(async () => {
    vi.clearAllMocks();
    fsMock = await import('fs');

    // Default setup: Key file does not exist, safeStorage available
    fsMock.existsSync.mockReturnValue(false);
    fsMock.promises.access.mockRejectedValue(new Error('File not found'));

    // safeStorage is already mocked at top

    const mockDataService = {
        getPath: vi.fn().mockReturnValue('/tmp')
    } as any;
    service = new SecurityService(mockDataService);
});

describe('SecurityService - Password Management', () => {
    describe('generatePassword', () => {
        it('should generate password of specified length', () => {
            const result = service.generatePassword(20);
            expect(result.success).toBe(true);
            expect(result.result?.password).toHaveLength(20);
        });

        it('should generate password with default length of 16', () => {
            const result = service.generatePassword();
            expect(result.success).toBe(true);
            expect(result.result?.password).toHaveLength(16);
        });

        it('should include numbers when specified', () => {
            const result = service.generatePassword(100, true, false);
            expect(result.success).toBe(true);
            expect(result.result?.password).toMatch(/[0-9]/);
        });

        it('should unique passwords', () => {
            const passwords = new Set<string>();
            for (let i = 0; i < 5; i++) {
                const res = service.generatePassword(32);
                if (res.success && res.result) { passwords.add(res.result.password); }
            }
            expect(passwords.size).toBe(5);
        });
    });

    describe('checkPasswordStrength', () => {
        it('should return score 0 for empty password', () => {
            const result = service.checkPasswordStrength('');
            expect(result.result?.score).toBe(0);
        });

        it('should return high score for strong password', () => {
            const result = service.checkPasswordStrength('MyP@ssw0rd123!');
            expect(result.result?.score).toBeGreaterThanOrEqual(4);
        });
    });
});

describe('SecurityService - Encryption and Hashing', () => {
    describe('generateHash', () => {
        it('should generate SHA256 hash by default', () => {
            const result = service.generateHash('test');
            expect(result.success).toBe(true);
            expect(result.result?.hash).toHaveLength(64);
        });

        it('should generate MD5 hash when specified', () => {
            const result = service.generateHash('test', 'md5');
            expect(result.result?.hash).toHaveLength(32);
        });
    });

    describe('encryptSync and decryptSync', () => {
        it('should handle round-trip encryption/decryption', () => {
            const original = 'This is a test message';
            const encrypted = service.encryptSync(original);
            const decrypted = service.decryptSync(encrypted);
            expect(decrypted).toBe(original);
        });

        it('should use Tengra:v1 format when master key is available', async () => {
            // Force master key to be loaded
            await service.initialize();

            const original = 'Sensitive Data';
            const encrypted = service.encryptSync(original);
            expect(encrypted).toMatch(/^Tengra:v1:/);

            const decrypted = service.decryptSync(encrypted);
            expect(decrypted).toBe(original);
        });

        it('should return null for empty input in decryptSync', () => {
            expect(service.decryptSync('')).toBeNull();
        });
    });

    describe('stripMetadata', () => {
        it('should copy file to output path', async () => {
            const fsPromises = (await import('fs')).promises;
            const result = await service.stripMetadata('/input/file.jpg', '/output/file.jpg');
            expect(result.success).toBe(true);
            expect(fsPromises.copyFile).toHaveBeenCalledWith('/input/file.jpg', '/output/file.jpg');
        });
    });
});

