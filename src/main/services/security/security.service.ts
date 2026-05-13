/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { ISecurityService } from '@main/types/services';
import { t } from '@main/utils/i18n.util';
import { SECURITY_CHANNELS } from '@shared/constants/ipc-channels';
import { ServiceResponse } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeStorage } from 'electron';

interface MasterKeyBackupPayload {
    schemaVersion: 'security-key-backup-v1';
    createdAt: number;
    salt: string;
    iv: string;
    authTag: string;
    encryptedKey: string;
    checksum: string;
}

const MASTER_KEY_BACKUP_SCHEMA_VERSION = 'security-key-backup-v1';
const MASTER_KEY_BACKUP_MIN_PASSPHRASE = 12;
const MASTER_KEY_BACKUP_SCRYPT_OPTIONS: crypto.ScryptOptions = {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
};

export class SecurityService extends BaseService implements ISecurityService {
    static readonly serviceName = 'securityService';
    static readonly dependencies = ['dataService'] as const;
    private masterKey: Buffer | null = null;
    private readonly keyPath: string;

    constructor(private dataService: DataService) {
        super('SecurityService');
        this.keyPath = path.join(this.dataService.getPath('config'), 'security.key');
    }

    override async initialize(): Promise<void> {
        await this.loadOrCreateMasterKey();
        this.testEncryption();
    }

    /** Securely zeros the master key buffer and releases resources. */
    override async cleanup(): Promise<void> {
        if (this.masterKey) {
            this.masterKey.fill(0);
            this.masterKey = null;
        }
        this.logInfo('Security service cleaned up');
    }

    getMasterKeyHex(): string | null {
        if (this.masterKey?.length !== 32) {
            return null;
        }

        return this.masterKey.toString('hex');
    }

    private async loadOrCreateMasterKey() {
        try {
            const keyExists = await fs.promises.access(this.keyPath).then(() => true).catch(() => false);
            if (keyExists) {
                const rawContent = (await fs.promises.readFile(this.keyPath, 'utf8')).trim();

                if (rawContent.startsWith('v2:')) {
                    try {
                        this.loadEncryptedKey(rawContent);
                    } catch (e) {
                        appLogger.error('SecurityService', `Corrupted Master Key detected: ${getErrorMessage(e)}. Regenerating...`);
                        await this.generateNewMasterKey();
                    }
                } else {
                    appLogger.warn('SecurityService', 'Legacy or unsupported key format. Regenerating...');
                    await this.generateNewMasterKey();
                }
            } else {
                await this.generateNewMasterKey();
            }
        } catch (e) {
            appLogger.error('SecurityService', `Failed to load/create Master Key: ${getErrorMessage(e)}`);
            this.masterKey = null;
        }
    }

    private loadEncryptedKey(encryptedContent: string) {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('error.auth.encryption_unavailable');
        }

        const ciphertext = encryptedContent.substring(3);
        const buffer = Buffer.from(ciphertext, 'base64');
        const hexKey = safeStorage.decryptString(buffer);

        this.masterKey = Buffer.from(hexKey, 'hex');
        if (this.masterKey.length !== 32) {
            throw new Error('error.auth.invalid_key_length');
        }
        appLogger.info('SecurityService', 'Master Key (Encrypted V2) loaded successfully.');
    }

    private async generateNewMasterKey() {
        this.masterKey = crypto.randomBytes(32);
        await this.saveMasterKeyEncrypted();
        appLogger.info('SecurityService', 'New Master Key generated and saved securely.');
    }

    private async saveMasterKeyEncrypted() {
        if (!this.masterKey) { return; }

        if (safeStorage.isEncryptionAvailable()) {
            const hexKey = this.masterKey.toString('hex');
            const encryptedBuffer = safeStorage.encryptString(hexKey);
            const content = `v2:${encryptedBuffer.toString('base64')}`;
            await fs.promises.writeFile(this.keyPath, content, 'utf8');
        } else {
            throw new Error('error.auth.storage_not_available');
        }
    }

    private testEncryption() {
        try {
            const test = 'Tengra-test-string';
            const encrypted = this.encryptSync(test);
            const decrypted = this.decryptSync(encrypted);

            if (decrypted === test) {
                appLogger.info('SecurityService', 'Encryption self-test passed (Tengra Versioned).');
            } else {
                appLogger.error('SecurityService', 'CRITICAL: Encryption self-test FAILED. Decrypted value verification mismatch.');
            }
        } catch (e) {
            appLogger.error('SecurityService', `CRITICAL: Encryption self-test crashed: ${getErrorMessage(e)}`);
        }
    }

    /**
     * NASA Rule 8: Validate all input parameters.
     * Uses CSPRNG for cryptographic security.
     */
    /**
     * Generates a cryptographically strong random password.
     * 
     * @param length - The length of the password (1-1024). Default is 16.
     * @param numbers - Whether to include numbers. Default is true.
     * @param symbols - Whether to include symbols. Default is true.
     * @returns A ServiceResponse containing the generated password.
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

    /**
     * Evaluates the strength of a given password.
     * 
     * @param password - The password string to evaluate.
     * @returns A ServiceResponse containing a score (0-5) and a descriptive label.
     */
    checkPasswordStrength(password: string): ServiceResponse<{ score: number; label: string }> {
        if (!password) {
            return { success: true, result: { score: 0, label: t('backend.veryWeak') } };
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

    /**
     * Generates a cryptographic hash of the provided text.
     * 
     * @param text - The input text to hash.
     * @param algorithm - The hashing algorithm to use ('md5', 'sha256', 'sha512'). Default is 'sha256'.
     * @returns A ServiceResponse containing the hex-encoded hash.
     */
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

    /**
     * Derives a deterministic backup encryption key from the provided passphrase.
     *
     * @param passphrase - Backup passphrase used to encrypt the key material.
     * @param salt - Random salt value encoded into backup payload.
     * @returns Derived AES-256 key material.
     */
    private deriveMasterKeyBackupKey(passphrase: string, salt: Buffer): Buffer {
        return crypto.scryptSync(passphrase, salt, 32, MASTER_KEY_BACKUP_SCRYPT_OPTIONS);
    }

    /**
     * Creates a password-protected backup of the master encryption key.
     *
     * @param passphrase - Backup passphrase used to encrypt the key material.
     * @returns Encrypted backup payload string.
     */
    createEncryptedMasterKeyBackup(passphrase: string): ServiceResponse<{ backup: string }> {
        if (!this.masterKey) {
            return { success: false, error: 'Master key is not initialized' };
        }
        if (passphrase.length < MASTER_KEY_BACKUP_MIN_PASSPHRASE) {
            return {
                success: false,
                error: `Passphrase must be at least ${MASTER_KEY_BACKUP_MIN_PASSPHRASE} characters`
            };
        }

        try {
            const salt = crypto.randomBytes(16);
            const iv = crypto.randomBytes(12);
            const key = this.deriveMasterKeyBackupKey(passphrase, salt);
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            const encrypted = Buffer.concat([
                cipher.update(this.masterKey),
                cipher.final()
            ]);
            const authTag = cipher.getAuthTag();
            const checksum = crypto.createHash('sha256').update(this.masterKey).digest('hex');
            const payload: MasterKeyBackupPayload = {
                schemaVersion: MASTER_KEY_BACKUP_SCHEMA_VERSION,
                createdAt: Date.now(),
                salt: salt.toString('base64'),
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                encryptedKey: encrypted.toString('base64'),
                checksum
            };
            return { success: true, result: { backup: JSON.stringify(payload) } };
        } catch (error) {
            this.logError('Master key backup creation failed', error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    /**
     * Restores master encryption key from an encrypted backup payload.
     *
     * @param backupPayload - Backup payload created by createEncryptedMasterKeyBackup.
     * @param passphrase - Passphrase used for backup encryption.
     * @returns Success response when key is restored and persisted.
     */
    async restoreMasterKeyBackup(backupPayload: string, passphrase: string): Promise<ServiceResponse> {
        if (!backupPayload) {
            return { success: false, error: 'Backup payload is required' };
        }
        if (passphrase.length < MASTER_KEY_BACKUP_MIN_PASSPHRASE) {
            return {
                success: false,
                error: `Passphrase must be at least ${MASTER_KEY_BACKUP_MIN_PASSPHRASE} characters`
            };
        }

        let parsed: MasterKeyBackupPayload;
        try {
            parsed = JSON.parse(backupPayload) as MasterKeyBackupPayload;
        } catch (error) {
            return { success: false, error: `Invalid backup payload: ${getErrorMessage(error as Error)}` };
        }

        if (
            parsed.schemaVersion !== MASTER_KEY_BACKUP_SCHEMA_VERSION ||
            !parsed.salt ||
            !parsed.iv ||
            !parsed.authTag ||
            !parsed.encryptedKey ||
            !parsed.checksum
        ) {
            return { success: false, error: 'Backup payload schema mismatch' };
        }

        try {
            const salt = Buffer.from(parsed.salt, 'base64');
            const iv = Buffer.from(parsed.iv, 'base64');
            const authTag = Buffer.from(parsed.authTag, 'base64');
            const encryptedKey = Buffer.from(parsed.encryptedKey, 'base64');
            const key = this.deriveMasterKeyBackupKey(passphrase, salt);
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([
                decipher.update(encryptedKey),
                decipher.final()
            ]);
            const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
            if (checksum !== parsed.checksum) {
                return { success: false, error: 'Master key backup checksum verification failed' };
            }

            this.masterKey = decrypted;
            await this.saveMasterKeyEncrypted();
            return { success: true };
        } catch (error) {
            this.logError('Master key backup restore failed', error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    /**
     * Strips metadata from a file by creating a copy at the output path.
     * Note: Current implementation is limited to copying.
     * 
     * @param path - The source file path.
     * @param outputPath - The destination file path.
     * @returns A ServiceResponse indicating success or failure.
     */
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

    /**
     * Synchronously encrypts text using Tengra Custom AES-256-GCM (v1)
     * with a fallback to Electron's safeStorage if the master key is unavailable.
     * 
     * @param text - The plain text to encrypt.
     * @returns The encrypted string with a version prefix, or the plain text if encryption fails.
     */
    encryptSync(text: string): string {
        if (!text) { return ''; }

        // 1. Try Custom AES-256-GCM first (Tengra V1)
        if (this.masterKey) {
            try {
                const iv = crypto.randomBytes(12);
                const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
                let encrypted = cipher.update(text, 'utf8', 'base64');
                encrypted += cipher.final('base64');
                const tag = cipher.getAuthTag().toString('base64');

                return `Tengra:v1:${iv.toString('base64')}:${tag}:${encrypted}`;
            } catch (error) {
                appLogger.error('SecurityService', `Tengra encryption failed: ${getErrorMessage(error as Error)}`);
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

        appLogger.error('SecurityService', 'Encryption not available - refusing plaintext fallback');
        return '';
    }

    /**
     * Synchronously decrypts text. Handles Tengra Custom V1 format
     * and legacy Electron safeStorage format.
     * 
     * @param encryptedText - The encrypted string to decrypt.
     * @returns The decrypted plain text, or null if decryption fails.
     */
    decryptSync(encryptedText: string): string | null {
        if (!encryptedText) { return null; }

        // Case A: Tengra Custom V1
        if (encryptedText.startsWith('Tengra:v1:')) {
            return this.decryptTengraV1(encryptedText);
        }

        // Case B: Legacy safeStorage (with or without v1: prefix)
        return this.decryptLegacyV1(encryptedText);
    }

    private decryptTengraV1(encryptedText: string): string | null {
        if (!this.masterKey) {
            appLogger.error('SecurityService', 'Master Key missing - cannot decrypt Tengra:v1 data');
            return null;
        }
        try {
            const parts = encryptedText.split(':');
            if (parts.length < 5) { throw new Error('error.auth.invalid_format'); }

            const iv = Buffer.from(parts[2], 'base64');
            const tag = Buffer.from(parts[3], 'base64');
            const encrypted = parts[4];

            const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
            decipher.setAuthTag(tag);

            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            const message = getErrorMessage(error as Error);
            if (message.includes('Unsupported state') || message.includes('auth tag')) {
                appLogger.warn('SecurityService', 'Tengra decryption failed (Auth Tag mismatch). Encrypted data is likely from a different session/environment. Re-authentication required.');
            } else {
                appLogger.error('SecurityService', `Tengra decryption failed: ${message}`);
            }
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

    /**
     * Resets the Master Key by deleting the key file and generating a new one.
     * WARNING: This will make all existing encrypted data unreadable.
     */
    @ipc(SECURITY_CHANNELS.RESET_MASTER_KEY)
    async resetMasterKey(): Promise<ServiceResponse> {
        try {
            this.logWarn('RESETTING MASTER KEY - All existing encrypted data will become unreadable!');

            // 1. Delete the key file
            const keyExists = await fs.promises.access(this.keyPath).then(() => true).catch(() => false);
            if (keyExists) {
                await fs.promises.unlink(this.keyPath);
            }

            // 2. Generate and save a new key
            await this.generateNewMasterKey();

            // 3. Run self-test
            this.testEncryption();

            return { success: true };
        } catch (error) {
            this.logError('Failed to reset master key', error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }
}

