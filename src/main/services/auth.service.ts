import * as fs from 'fs'
import * as path from 'path'
import { DataService } from './data/data.service'
import { SecurityService } from './security.service'

export class AuthService {
    private authDir: string

    constructor(
        private dataService: DataService,
        private securityService: SecurityService
    ) {
        this.authDir = this.dataService.getPath('auth')
    }

    saveToken(provider: string, token: string): void {
        console.log(`[AuthService] Saving token for ${provider} (len=${token.length})`)
        const encrypted = this.securityService.encryptSync(token)
        const filePath = path.join(this.authDir, `${provider}.json`)
        const data = {
            provider,
            token: encrypted,
            updatedAt: Date.now()
        }
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
            console.log(`[AuthService] Wrote ${filePath}`)
        } catch (e) {
            console.error(`[AuthService] Failed to write ${filePath}:`, e)
        }
    }

    getToken(provider: string): string | undefined {
        const baseName = provider.replace(/\.(json|enc)$/, '');
        const possiblePaths = [
            path.join(this.authDir, `${baseName}.json`),
            path.join(this.authDir, `${baseName}.enc`),
            path.join(this.authDir, baseName)
        ];

        let filePath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }

        if (!filePath) return undefined;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            let toDecrypt = content;

            // Try to see if it's a JSON wrapper first
            try {
                const data = JSON.parse(content);

                const extractString = (obj: Record<string, unknown>): string | null => {
                    if (!obj) return null;
                    const candidates = ['token', 'encryptedPayload', 'ciphertext', 'data', 'access_token', 'accessToken'];
                    for (const c of candidates) {
                        if (typeof obj[c] === 'string' && obj[c]) return obj[c] as string;
                        if (typeof obj[c] === 'object' && obj[c] !== null) {
                            const nested = extractString(obj[c] as Record<string, unknown>);
                            if (nested) return nested;
                        }
                    }
                    return null;
                };

                const payload = extractString(data);
                if (payload) {
                    toDecrypt = payload;
                }
            } catch { /* Not JSON at the top level, treat as raw content */ }

            // If it was a JSON wrapper, toDecrypt might still be JSON (wrapping the encrypted payload)
            if (toDecrypt.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(toDecrypt);
                    const nestedPayload = (parsed.encryptedPayload || parsed.ciphertext || parsed.token || parsed.data) as string;
                    if (typeof nestedPayload === 'string') {
                        toDecrypt = nestedPayload;
                    }
                } catch { /* Not JSON or no payload field */ }
            }

            let decrypted = toDecrypt.trim().startsWith('{') ? null : this.securityService.decryptSync(toDecrypt);

            // Fallback 1: Try decrypting the raw file content if it doesn't look like JSON
            if (decrypted === null && toDecrypt !== content && !content.trim().startsWith('{')) {
                decrypted = this.securityService.decryptSync(content);
            }

            // Fallback 2: If still no decryption, maybe it's already plain text?
            if (decrypted === null) {
                const potentialToken = (toDecrypt || content).trim();
                // If it's not JSON (after possible extraction), it's probably the token itself
                if (potentialToken && !potentialToken.startsWith('{')) {
                    return potentialToken;
                }
                console.warn(`[AuthService] Could not decrypt or extract plain token from ${path.basename(filePath)}`);
                return undefined;
            }

            // If we got here, we have a decrypted string. It might be a JSON object containing the real token.
            if (decrypted.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(decrypted);
                    const token = parsed.access_token || parsed.token?.access_token || parsed.token || parsed.apiKey || parsed.accessToken;
                    if (typeof token === 'string' && token) return token.trim();
                } catch { /* Not JSON or no token field */ }
            }

            return decrypted.trim();
        } catch (error) {
            console.error(`[AuthService] Failed to read token from ${filePath}:`, error)
        }
        return undefined
    }

    deleteToken(provider: string): void {
        const filePath = path.join(this.authDir, `${provider}.json`)
        if (fs.existsSync(filePath)) {
            console.warn(`[AuthService] Deleting token file for provider: ${provider}`);
            fs.unlinkSync(filePath)
        }
    }

    getAllTokens(): Record<string, string> {
        const tokens: Record<string, string> = {}
        try {
            if (!fs.existsSync(this.authDir)) return tokens

            const files = fs.readdirSync(this.authDir)
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.enc')) {
                    try {
                        const provider = file.replace(/\.(json|enc)$/, '')
                        const token = this.getToken(provider)
                        if (token) {
                            tokens[provider] = token
                            console.log(`[AuthService] Loaded token for ${provider}, length: ${token.length}`)
                        } else {
                            console.warn(`[AuthService] Failed to get token for ${provider} (file: ${file})`)
                        }
                    } catch (e) {
                        console.warn(`[AuthService] Skipping ${file} during load:`, e)
                    }
                }
            }
        } catch (error) {
            console.error('[AuthService] Failed to load all tokens:', error)
        }
        return tokens
    }
}
