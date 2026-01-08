import * as fs from 'fs'
import * as path from 'path'
import { DataService } from './data.service'
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
        const encrypted = this.securityService.encryptSync(token)
        const filePath = path.join(this.authDir, `${provider}.json`)
        const data = {
            provider,
            token: encrypted,
            updatedAt: Date.now()
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    }

    getToken(provider: string): string | undefined {
        const filePath = path.join(this.authDir, `${provider}.json`)
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8')
                const data = JSON.parse(content)
                if (data.token && typeof data.token === 'string') {
                    return this.securityService.decryptSync(data.token)
                }
            }
        } catch (error) {
            console.error(`[AuthService] Failed to read token for ${provider}:`, error)
        }
        return undefined
    }

    deleteToken(provider: string): void {
        const filePath = path.join(this.authDir, `${provider}.json`)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    }

    getAllTokens(): Record<string, string> {
        const tokens: Record<string, string> = {}
        try {
            if (!fs.existsSync(this.authDir)) return tokens

            const files = fs.readdirSync(this.authDir)
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const provider = file.replace('.json', '')
                        const token = this.getToken(provider)
                        if (token) {
                            tokens[provider] = token
                        }
                    } catch (e) {
                        console.warn(`[AuthService] Skipping ${file} during load.`)
                    }
                }
            }
        } catch (error) {
            console.error('[AuthService] Failed to load all tokens:', error)
        }
        return tokens
    }
}
