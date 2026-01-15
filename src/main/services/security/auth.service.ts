import * as fs from 'fs'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { BaseService } from '@main/services/base.service'
import { DataService } from '@main/services/data/data.service'
import { AuthToken, DatabaseService } from '@main/services/data/database.service'
import { SecurityService } from '@main/services/security/security.service'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'

export class AuthService extends BaseService {
    private authDir: string

    constructor(
        private dataService: DataService,
        private securityService: SecurityService,
        private databaseService: DatabaseService
    ) {
        super('AuthService')
        this.authDir = this.dataService.getPath('auth')
        this.migrateLegacyTokens().catch(err => {
            appLogger.error('AuthService', `Legacy migration failed: ${getErrorMessage(err)}`)
        })
    }

    async saveToken(provider: string, token: string | Partial<AuthToken>): Promise<void> {
        if (!provider || !token) {
            appLogger.error('AuthService', 'Provider and token are required for saving');
            return;
        }

        const authToken: AuthToken = {
            id: provider,
            provider: provider,
            updatedAt: Date.now()
        };

        if (typeof token === 'object') {
            this.populateTokenFromObject(authToken, token);
        } else {
            this.populateTokenFromString(authToken, token);
        }

        await this.databaseService.saveAuthToken(authToken);
    }

    private populateTokenFromObject(dest: AuthToken, src: Partial<AuthToken>): void {
        dest.accessToken = src.accessToken ? this.encrypt(src.accessToken) : undefined;
        dest.refreshToken = src.refreshToken ? this.encrypt(src.refreshToken) : undefined;
        dest.sessionToken = src.sessionToken ? this.encrypt(src.sessionToken) : undefined;
        dest.expiresAt = src.expiresAt;
        dest.scope = src.scope;
        dest.metadata = src.metadata;
    }

    private populateTokenFromString(dest: AuthToken, token: string): void {
        let parsed: JsonObject | null = null;
        try {
            const json = JSON.parse(token);
            if (json && typeof json === 'object' && !Array.isArray(json)) {
                parsed = json as JsonObject;
            }
        } catch {
            // Ignored - treat as raw string
        }

        if (parsed) {
            dest.accessToken = this.extractAccessToken(parsed);
            dest.refreshToken = parsed.refresh_token ? this.encrypt(String(parsed.refresh_token)) : undefined;
            dest.expiresAt = parsed.expires_in ? Date.now() + (Number(parsed.expires_in) * 1000) : undefined;
            dest.metadata = parsed;
        } else {
            dest.accessToken = this.encrypt(token);
        }
    }

    private extractAccessToken(obj: JsonObject): string | undefined {
        const val = obj.access_token ?? obj.token;
        return val ? this.encrypt(String(val)) : undefined;
    }

    private encrypt(text: string): string {
        return this.securityService.encryptSync(text) || ''
    }

    private decrypt(text: string | undefined): string | undefined {
        if (!text) { return undefined; }
        const decrypted = this.securityService.decryptSync(text);
        return decrypted ?? undefined;
    }

    async getToken(provider: string): Promise<string | undefined> {
        const token = await this.databaseService.getAuthToken(provider);
        if (!token) { return undefined; }

        // Return the most relevant token for legacy consumers
        return this.decrypt(token.accessToken) ?? this.decrypt(token.sessionToken) ?? this.decrypt(token.refreshToken);
    }

    async getAuthToken(provider: string): Promise<AuthToken | null> {
        const token = await this.databaseService.getAuthToken(provider);
        if (!token) { return null; }

        // Decrypt fields before returning
        return {
            ...token,
            accessToken: this.decrypt(token.accessToken),
            refreshToken: this.decrypt(token.refreshToken),
            sessionToken: this.decrypt(token.sessionToken)
        };
    }

    async deleteToken(provider: string): Promise<void> {
        await this.databaseService.deleteAuthToken(provider)
    }

    async getAllTokens(): Promise<Record<string, string>> {
        const tokens = await this.databaseService.getAllAuthTokens();
        const result: Record<string, string> = {};
        for (const t of tokens) {
            const val = this.decrypt(t.accessToken) ?? this.decrypt(t.sessionToken);
            if (val) {
                result[t.id] = val;
            }
        }
        return result;
    }

    async getAllFullTokens(): Promise<AuthToken[]> {
        const tokens = await this.databaseService.getAllAuthTokens();
        return tokens.map(t => ({
            ...t,
            accessToken: this.decrypt(t.accessToken),
            refreshToken: this.decrypt(t.refreshToken),
            sessionToken: this.decrypt(t.sessionToken)
        }));
    }

    private async migrateLegacyTokens() {
        if (!fs.existsSync(this.authDir)) { return; }

        try {
            const files = await fs.promises.readdir(this.authDir);
            for (const file of files) {
                await this.migrateLegacyTokenFile(file);
            }
        } catch (error) {
            appLogger.error('AuthService', `Migration failed: ${getErrorMessage(error as Error)}`);
        }
    }

    private async migrateLegacyTokenFile(file: string): Promise<void> {
        if (!file.endsWith('.json') && !file.endsWith('.enc')) { return; }

        const filePath = path.join(this.authDir, file);
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const provider = file.replace(/\.(json|enc)$/, '');

            const legacyToken = this.processTokenContent(content);
            if (!legacyToken) { return; }

            const existing = await this.databaseService.getAuthToken(provider);
            if (!existing) {
                await this.saveToken(provider, legacyToken);
                appLogger.info('AuthService', `Migrated legacy token for ${provider}`);
            }

            // Rename to .migrated
            await fs.promises.rename(filePath, filePath + '.migrated');
        } catch (error) {
            appLogger.error('AuthService', `Failed to migrate token file ${file}: ${getErrorMessage(error as Error)}`);
        }
    }

    // Legacy helpers for migration
    private processTokenContent(content: string): string | undefined {
        // 1. Try to extract payload from JSON if applicable
        const payload = this.extractEncryptedPayload(content);

        // 2. Try to decrypt
        const decrypted = this.securityService.decryptSync(payload);

        // 3. Fallback: If decryption failed, check if it's already plain text (legacy)
        if (decrypted === null) {
            if (!payload.trim().startsWith('{')) {
                return payload.trim();
            }
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
        if (!trimmed.startsWith('{')) { return trimmed; }

        try {
            const data = JSON.parse(trimmed) as Record<string, unknown>;
            const candidates = ['token', 'encryptedPayload', 'ciphertext', 'data', 'access_token', 'accessToken'];

            for (const key of candidates) {
                const found = this.findCandidateValue(data, key, candidates);
                if (found) { return found; }
            }
        } catch { /* Fail silently, return original */ }
        return trimmed;
    }

    private findCandidateValue(data: Record<string, unknown>, key: string, candidates: string[]): string | null {
        const val = data[key];
        if (typeof val === 'string' && val) { return val; }

        if (typeof val === 'object' && val !== null) {
            const nested = val as Record<string, unknown>;
            for (const subKey of candidates) {
                const subVal = nested[subKey];
                if (typeof subVal === 'string' && subVal) { return subVal; }
            }
        }
        return null;
    }

    private extractTokenFromPlainJSON(jsonStr: string): string {
        try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            const token = parsed.access_token ??
                (parsed.token as Record<string, unknown> | undefined)?.access_token ??
                parsed.token ??
                parsed.apiKey ??
                parsed.accessToken;

            if (typeof token === 'string' && token) { return token.trim(); }
        } catch { /* Fail silently */ }
        return jsonStr.trim();
    }
}
