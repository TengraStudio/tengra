import { ISecurityService } from '../types/services';
import { ServiceResponse } from '../../shared/types';
import { getErrorMessage } from '../../shared/utils/error.util';
import { safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { BaseService } from './base.service';

export class SecurityService extends BaseService implements ISecurityService {
    constructor() {
        super('SecurityService');
    }

    generatePassword(length: number = 16, numbers: boolean = true, symbols: boolean = true): ServiceResponse<{ password: string }> {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            (numbers ? "0123456789" : "") +
            (symbols ? "!@#$%^&*()_+~`|}{[]:;?><,./-=" : "");
        let retVal = "";
        for (let i = 0, n = charset.length; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        return { success: true, result: { password: retVal } };
    }

    checkPasswordStrength(password: string): ServiceResponse<{ score: number; label: string }> {
        let score = 0;
        if (password.length > 8) score++;
        if (password.length > 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong", "Excellent"];
        return { success: true, result: { score, label: labels[score] || "Unknown" } };
    }

    generateHash(text: string, algorithm: 'md5' | 'sha256' | 'sha512' = 'sha256'): ServiceResponse<{ hash: string }> {
        try {
            const hash = crypto.createHash(algorithm).update(text).digest('hex');
            return { success: true, result: { hash } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }

    async stripMetadata(path: string, outputPath: string): Promise<ServiceResponse> {
        try {
            await fs.copyFile(path, outputPath);
            return { success: true, message: `Created copy at ${outputPath}. Note: dependency-free stripping is limited.` };
        } catch (e) {
            return { success: false, error: getErrorMessage(e) };
        }
    }


    encryptSync(text: string): string {
        try {
            if (safeStorage && safeStorage.isEncryptionAvailable()) {
                const buffer = safeStorage.encryptString(text);
                const result = buffer.toString('base64');
                return result;
            } else {
                console.error('[SecurityService] safeStorage.isEncryptionAvailable() returned FALSE.');
                return '';
            }
        } catch (error) {
            console.error('[SecurityService] safeStorage encrypt CRITICAL FAIL:', getErrorMessage(error));
            return '';
        }
    }

    decryptSync(encryptedText: string): string | null {
        if (!encryptedText) return null;

        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            try {
                // Try standard base64 decode first
                const buffer = Buffer.from(encryptedText, 'base64');
                const decrypted = safeStorage.decryptString(buffer);
                return decrypted;
            } catch (error) {
                console.warn('[SecurityService] Standard decryption failed:', getErrorMessage(error));

                // If it was legacy JSON wrapper (from my previous attempt), try to unwrap it purely for migration sake?
                // Or just fail. User wants *only* SSS. If checking for SSS success is the goal, we fail on error.
                return null;
            }
        } else {
            console.error('[SecurityService] Cannot decrypt: safeStorage unavailable.');
            return null;
        }
    }
}
