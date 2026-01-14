/**
 * Unit tests for SecurityService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock fs/promises
vi.mock('fs/promises', () => ({
    copyFile: vi.fn().mockResolvedValue(undefined)
}));

import { SecurityService } from '../../../main/services/security.service';

describe('SecurityService', () => {
    let service: SecurityService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new SecurityService();
    });

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

        it('should include symbols when specified', () => {
            const result = service.generatePassword(100, false, true);

            expect(result.success).toBe(true);
            expect(result.result?.password).toMatch(/[!@#$%^&*()_+~`|}{[\]:;?><,./-]/);
        });

        it('should only include letters when numbers and symbols are disabled', () => {
            const result = service.generatePassword(50, false, false);

            expect(result.success).toBe(true);
            expect(result.result?.password).toMatch(/^[a-zA-Z]+$/);
        });

        it('should reject length less than 1', () => {
            const result = service.generatePassword(0);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid password length');
        });

        it('should reject length greater than 1024', () => {
            const result = service.generatePassword(1025);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid password length');
        });

        it('should generate unique passwords', () => {
            const passwords = new Set<string>();
            for (let i = 0; i < 10; i++) {
                const result = service.generatePassword(32);
                if (result.success && result.result) {
                    passwords.add(result.result.password);
                }
            }

            expect(passwords.size).toBe(10);
        });
    });

    describe('checkPasswordStrength', () => {
        it('should return score 0 for empty password', () => {
            const result = service.checkPasswordStrength('');

            expect(result.success).toBe(true);
            expect(result.result?.score).toBe(0);
            expect(result.result?.label).toBe('Very Weak');
        });

        it('should return low score for short password', () => {
            const result = service.checkPasswordStrength('abc');

            expect(result.success).toBe(true);
            expect(result.result?.score).toBeLessThan(3);
        });

        it('should increase score for longer passwords', () => {
            const short = service.checkPasswordStrength('abcd');
            const medium = service.checkPasswordStrength('abcdefghij');
            const long = service.checkPasswordStrength('abcdefghijklmno');

            expect(medium.result!.score).toBeGreaterThan(short.result!.score);
            expect(long.result!.score).toBeGreaterThan(medium.result!.score);
        });

        it('should increase score for uppercase letters', () => {
            const lower = service.checkPasswordStrength('abcdefghij');
            const mixed = service.checkPasswordStrength('abcdeFGHIJ');

            expect(mixed.result!.score).toBeGreaterThan(lower.result!.score);
        });

        it('should increase score for numbers', () => {
            const noNumbers = service.checkPasswordStrength('abcdefghij');
            const withNumbers = service.checkPasswordStrength('abcd123456');

            expect(withNumbers.result!.score).toBeGreaterThan(noNumbers.result!.score);
        });

        it('should increase score for special characters', () => {
            const noSpecial = service.checkPasswordStrength('abcdefghij');
            const withSpecial = service.checkPasswordStrength('abcdef!@#$');

            expect(withSpecial.result!.score).toBeGreaterThan(noSpecial.result!.score);
        });

        it('should return high score for strong password', () => {
            const result = service.checkPasswordStrength('MyP@ssw0rd123!');

            expect(result.success).toBe(true);
            expect(result.result?.score).toBeGreaterThanOrEqual(4);
        });
    });

    describe('generateHash', () => {
        it('should generate SHA256 hash by default', () => {
            const result = service.generateHash('test');

            expect(result.success).toBe(true);
            expect(result.result?.hash).toHaveLength(64); // SHA256 hex = 64 chars
        });

        it('should generate MD5 hash when specified', () => {
            const result = service.generateHash('test', 'md5');

            expect(result.success).toBe(true);
            expect(result.result?.hash).toHaveLength(32); // MD5 hex = 32 chars
        });

        it('should generate SHA512 hash when specified', () => {
            const result = service.generateHash('test', 'sha512');

            expect(result.success).toBe(true);
            expect(result.result?.hash).toHaveLength(128); // SHA512 hex = 128 chars
        });

        it('should return error for empty input', () => {
            const result = service.generateHash('');

            expect(result.success).toBe(false);
            expect(result.error).toContain('required');
        });

        it('should generate consistent hashes for same input', () => {
            const result1 = service.generateHash('hello world');
            const result2 = service.generateHash('hello world');

            expect(result1.result?.hash).toBe(result2.result?.hash);
        });

        it('should generate different hashes for different inputs', () => {
            const result1 = service.generateHash('hello');
            const result2 = service.generateHash('world');

            expect(result1.result?.hash).not.toBe(result2.result?.hash);
        });
    });

    describe('stripMetadata', () => {
        it('should copy file to output path', async () => {
            const fs = await import('fs/promises');
            const result = await service.stripMetadata('/input/file.jpg', '/output/file.jpg');

            expect(result.success).toBe(true);
            expect(fs.copyFile).toHaveBeenCalledWith('/input/file.jpg', '/output/file.jpg');
        });

        it('should return error for empty source path', async () => {
            const result = await service.stripMetadata('', '/output/file.jpg');

            expect(result.success).toBe(false);
            expect(result.error).toContain('required');
        });

        it('should return error for empty output path', async () => {
            const result = await service.stripMetadata('/input/file.jpg', '');

            expect(result.success).toBe(false);
            expect(result.error).toContain('required');
        });
    });

    describe('encryptSync', () => {
        it('should encrypt text using safeStorage', () => {
            const result = service.encryptSync('secret data');

            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return empty string for empty input', () => {
            const result = service.encryptSync('');

            expect(result).toBe('');
        });

        it('should return base64 encoded result', () => {
            const result = service.encryptSync('test');

            // Should be valid base64
            expect(() => Buffer.from(result, 'base64')).not.toThrow();
        });
    });

    describe('decryptSync', () => {
        it('should decrypt encrypted text', () => {
            const encrypted = service.encryptSync('my secret');
            const decrypted = service.decryptSync(encrypted);

            expect(decrypted).toBe('my secret');
        });

        it('should return null for empty input', () => {
            const result = service.decryptSync('');

            expect(result).toBeNull();
        });

        it('should handle round-trip encryption/decryption', () => {
            const original = 'This is a test message with special chars: !@#$%^&*()';
            const encrypted = service.encryptSync(original);
            const decrypted = service.decryptSync(encrypted);

            expect(decrypted).toBe(original);
        });
    });
});
