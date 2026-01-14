import * as fs from 'fs'
import * as path from 'path'

import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { SecurityService } from '@main/services/security.service'
import { getErrorMessage } from '@shared/utils/error.util'

export class AuthService extends BaseService {
    private authDir: string

    constructor(
        private dataService: DataService,
        private securityService: SecurityService
    ) {
        super('AuthService')
        this.authDir = this.dataService.getPath('auth')
    }

    saveToken(provider: string, token: string): void {
        if (!provider || !token) {
            console.error('[AuthService] Provider and token are required for saving');
            return;
        }

        const encrypted = this.securityService.encryptSync(token);
        if (!encrypted) {
            console.error(`[AuthService] Encryption failed for provider: ${provider}`);
            return;
        }

        const filePath = path.join(this.authDir, `${provider}.json`);
        const data = {
            provider,
            token: encrypted,
            updatedAt: Date.now()
        };

        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[AuthService] Failed to write ${filePath}:`, getErrorMessage(e));
        }
    }

    getToken(provider: string): string | undefined {
        if (!provider) {return undefined;}

        const filePath = this.resolveFilePath(provider);
        if (!filePath) {return undefined;}

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this.processTokenContent(content, filePath);
        } catch (error) {
            console.error(`[AuthService] Failed to read token from ${filePath}:`, getErrorMessage(error));
        }
        return undefined;
    }

    private resolveFilePath(provider: string): string | undefined {
        const baseName = provider.replace(/\.(json|enc)$/, '');
        const possiblePaths = [
            path.join(this.authDir, `${baseName}.json`),
            path.join(this.authDir, `${baseName}.enc`),
            path.join(this.authDir, baseName)
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {return p;}
        }
        return undefined;
    }

    private processTokenContent(content: string, filePath: string): string | undefined {
        // 1. Try to extract payload from JSON if applicable
        const payload = this.extractEncryptedPayload(content);

        // 2. Try to decrypt
        const decrypted = this.securityService.decryptSync(payload);

        // 3. Fallback: If decryption failed, check if it's already plain text (legacy)
        if (decrypted === null) {
            if (!payload.trim().startsWith('{')) {
                return payload.trim();
            }
            console.warn(`[AuthService] Could not decrypt or extract plain token from ${path.basename(filePath)}`);
            return undefined;
        }

        // 4. If decrypted content is JSON, extract final token (legacy nested format)
        if (decrypted.trim().startsWith('{')) {
            return this.extractTokenFromPlainJSON(decrypted);
        }

        return decrypted.trim();
    }

    private extractEncryptedPayload(content: string): string {
        const trimmed = content.trim();
        if (!trimmed.startsWith('{')) {return trimmed;}

        try {
            const data = JSON.parse(trimmed) as Record<string, unknown>;
            const candidates = ['token', 'encryptedPayload', 'ciphertext', 'data', 'access_token', 'accessToken'];

            for (const key of candidates) {
                const val = data[key];
                if (typeof val === 'string' && val) {return val;}
                // Shallow search for nested objects (limit depth for NASA Rule 4)
                if (typeof val === 'object' && val !== null) {
                    const nested = val as Record<string, unknown>;
                    for (const subKey of candidates) {
                        const subVal = nested[subKey];
                        if (typeof subVal === 'string' && subVal) {return subVal;}
                    }
                }
            }
        } catch { /* Fail silently, return original */ }
        return trimmed;
    }

    private extractTokenFromPlainJSON(jsonStr: string): string {
        try {
            const parsed = JSON.parse(jsonStr) as Record<string, any>;
            const token = parsed.access_token || parsed.token?.access_token || parsed.token || parsed.apiKey || parsed.accessToken;
            if (typeof token === 'string' && token) {return token.trim();}
        } catch { /* Fail silently */ }
        return jsonStr.trim();
    }

    deleteToken(provider: string): void {
        if (!provider) {return;}
        const filePath = path.join(this.authDir, `${provider}.json`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error(`[AuthService] Failed to delete token for ${provider}:`, getErrorMessage(e));
            }
        }
    }

    getAllTokens(): Record<string, string> {
        const tokens: Record<string, string> = {};
        if (!fs.existsSync(this.authDir)) {return tokens;}

        try {
            const files = fs.readdirSync(this.authDir);
            for (const file of files) {
                // Limit loop to avoid indefinite execution (NASA Rule 2)
                if (Object.keys(tokens).length > 100) {break;}

                if (file.endsWith('.json') || file.endsWith('.enc')) {
                    const provider = file.replace(/\.(json|enc)$/, '');
                    const token = this.getToken(provider);
                    if (token) {tokens[provider] = token;}
                }
            }
        } catch (error) {
            console.error('[AuthService] Failed to load all tokens:', getErrorMessage(error));
        }
        return tokens;
    }

}
