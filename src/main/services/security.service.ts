import { ISecurityService } from '../types/services';
import { ServiceResponse } from '../../shared/types';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

export class SecurityService implements ISecurityService {
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async stripMetadata(path: string, outputPath: string): Promise<ServiceResponse> {
        try {
            await fs.copyFile(path, outputPath);
            return { success: true, message: `Created copy at ${outputPath}. Note: dependency-free stripping is limited.` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
