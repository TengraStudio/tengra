import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { ISecurityService } from '@main/types/services';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeStorage } from 'electron';

export class SecurityService extends BaseService implements ISecurityService {
    private masterKey: Buffer | null = null;
    private readonly keyPath: string;

    constructor(private dataService: DataService) {
        super('SecurityService');
        this.keyPath = path.join(this.dataService.getPath('config'), 'security.key');
    }

    override async initialize(): Promise<void> {
        this.loadOrCreateMasterKey();
        this.testEncryption();
    }

    private loadOrCreateMasterKey() {
        try {
            if (fs.existsSync(this.keyPath)) {
                const hexKey = fs.readFileSync(this.keyPath, 'utf8').trim();
                this.masterKey = Buffer.from(hexKey, 'hex');
                if (this.masterKey.length !== 32) {
                    throw new Error('Invalid master key length');
                }
                appLogger.info('SecurityService', 'Master Key loaded successfully.');
            } else {
                this.masterKey = crypto.randomBytes(32);
                fs.writeFileSync(this.keyPath, this.masterKey.toString('hex'), 'utf8');
                appLogger.info('SecurityService', 'New Master Key generated and saved.');
            }
        } catch (e) {
            appLogger.error('SecurityService', `Failed to load/create Master Key: ${getErrorMessage(e)}`);
            // Critical failure: we can't encrypt safely if we can't persist the key
            this.masterKey = null;
        }
    }

    private testEncryption() {
        try {
            const test = 'orbit-test-string'
            const encrypted = this.encryptSync(test)
            const decrypted = this.decryptSync(encrypted)

            if (decrypted === test) {
                appLogger.info('SecurityService', 'Encryption self-test passed (Orbit Versioned).');
            } else {
                appLogger.error('SecurityService', 'CRITICAL: Encryption self-test FAILED. Decrypted value verification mismatch.');
            }
        } catch (e) {
            appLogger.error('SecurityService', `CRITICAL: Encryption self-test crashed: ${getErrorMessage(e)}`)
        }
    }

    /**
     * NASA Rule 8: Validate all input parameters.
     * Uses CSPRNG for cryptographic security.
     */
    generatePassword(length: number = 16, numbers: boolean = true, symbols: boolean = true): ServiceResponse<{ password: string }> {
        if (length < 1 || length > 1024) {
            return { success: false, error: 'Invalid password length (must be 1-1024)' };
        }

        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            (numbers ? "0123456789" : "") +
            (symbols ? "!@#$%^&*()_+~`|}{[]:;?><,./-=" : "");

        const charsetLength = charset.length;
        let retVal = "";

        try {
            const randomBytes = crypto.randomBytes(length);
            for (let i = 0; i < length; ++i) {
                retVal += charset.charAt(randomBytes[i] % charsetLength);
            }
            return { success: true, result: { password: retVal } };
        } catch (e) {
            this.logError(`Password generation failed`, e);
            return { success: false, error: `Failed to generate random bytes: ${getErrorMessage(e)}` };
        }
    }

    checkPasswordStrength(password: string): ServiceResponse<{ score: number; label: string }> {
        if (!password) {
            return { success: true, result: { score: 0, label: "Very Weak" } };
        }

        let score = 0;
        if (password.length > 8) { score++; }
        if (password.length > 12) { score++; }
        if (/[A-Z]/.test(password)) { score++; }
        if (/[0-9]/.test(password)) { score++; }
        if (/[^A-Za-z0-9]/.test(password)) { score++; }

        const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong", "Excellent"];
        return { success: true, result: { score, label: labels[score] || "Unknown" } };
    }

    generateHash(text: string, algorithm: 'md5' | 'sha256' | 'sha512' = 'sha256'): ServiceResponse<{ hash: string }> {
        if (!text) {
            return { success: false, error: 'Input text is required for hashing' };
        }
        try {
            const hash = crypto.createHash(algorithm).update(text).digest('hex');
            return { success: true, result: { hash } };
        } catch (e) {
            this.logError(`Hash generation failed for algorithm ${algorithm}`, e);
            return { success: false, error: getErrorMessage(e) };
        }
    }

    async stripMetadata(path: string, outputPath: string): Promise<ServiceResponse> {
        if (!path || !outputPath) {
            return { success: false, error: 'Source and output paths are required' };
        }
        try {
            await fs.promises.copyFile(path, outputPath);
            return { success: true, message: `Created copy at ${outputPath}. Note: dependency-free stripping is limited.` };
        } catch (e) {
            this.logError(`Metadata stripping failed from ${path} to ${outputPath}`, e);
            return { success: false, error: getErrorMessage(e) };
        }
    }

    encryptSync(text: string): string {
        if (!text) { return ''; }

        // 1. Try Custom AES-256-GCM first (Orbit V1)
        if (this.masterKey) {
            try {
                const iv = crypto.randomBytes(12);
                const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
                let encrypted = cipher.update(text, 'utf8', 'base64');
                encrypted += cipher.final('base64');
                const tag = cipher.getAuthTag().toString('base64');

                return `orbit:v1:${iv.toString('base64')}:${tag}:${encrypted}`;
            } catch (error) {
                appLogger.error('SecurityService', `Orbit encryption failed: ${getErrorMessage(error as Error)}`);
            }
        }

        // 2. Fallback to Electron safeStorage (Legacy V1)
        try {
            if (safeStorage.isEncryptionAvailable()) {
                const buffer = safeStorage.encryptString(text);
                return `v1:${buffer.toString('base64')}`;
            }
        } catch (error) {
            appLogger.error('SecurityService', `safeStorage encryption failed: ${getErrorMessage(error as Error)}`);
        }

        appLogger.error('SecurityService', 'Encryption not available - returning plain text (CAUTION)');
        return text;
    }

    decryptSync(encryptedText: string): string | null {
        if (!encryptedText) { return null; }

        // Case A: Orbit Custom V1
        if (encryptedText.startsWith('orbit:v1:')) {
            return this.decryptOrbitV1(encryptedText);
        }

        // Case B: Legacy safeStorage (with or without v1: prefix)
        return this.decryptLegacyV1(encryptedText);
    }

    private decryptOrbitV1(encryptedText: string): string | null {
        if (!this.masterKey) {
            appLogger.error('SecurityService', 'Master Key missing - cannot decrypt orbit:v1 data');
            return null;
        }
        try {
            const parts = encryptedText.split(':');
            if (parts.length < 5) { throw new Error('Invalid orbit:v1 format'); }

            const iv = Buffer.from(parts[2], 'base64');
            const tag = Buffer.from(parts[3], 'base64');
            const encrypted = parts[4];

            const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
            decipher.setAuthTag(tag);

            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            appLogger.error('SecurityService', `Orbit decryption failed: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private decryptLegacyV1(encryptedText: string): string | null {
        const isLegacyWithPrefix = encryptedText.startsWith('v1:');
        const rawCiphertext = isLegacyWithPrefix ? encryptedText.substring(3) : encryptedText;

        try {
            if (safeStorage.isEncryptionAvailable()) {
                const buffer = Buffer.from(rawCiphertext, 'base64');
                return safeStorage.decryptString(buffer);
            }
        } catch (error) {
            const err = getErrorMessage(error as Error);
            const lowerErr = err.toLowerCase();

            // If it's a "Decryption failed" or "not encrypted" error, handle as plain-text or broken DPAPI
            if (lowerErr.includes('ciphertext does not appear to be encrypted') || lowerErr.includes('decryption failed')) {
                // If it HAS a known prefix, do NOT return it as plaintext - it's corrupted/unreadable
                if (isLegacyWithPrefix) {
                    appLogger.error('SecurityService', `Legacy decryption FAILED for versioned data: ${err}`);
                    return null;
                }

                // Otherwise, it might be an unencrypted legacy token
                return encryptedText;
            } else {
                appLogger.warn('SecurityService', `Legacy decryption failed (Unexpected): ${err}`);
            }
        }

        return null;
    }
}
