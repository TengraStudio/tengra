import { CopilotService } from '@main/services/llm/copilot.service'
import { ProxyService } from '@main/services/proxy/proxy.service'
import { AuthService, TokenData } from '@main/services/security/auth.service'
import { SettingsService } from '@main/services/system/settings.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { ipcMain } from 'electron'

export function registerAuthIpc(
    proxyService: ProxyService,
    settingsService: SettingsService,
    copilotService: CopilotService,
    authService: AuthService
) {
    // --- GitHub/Copilot Device Code Flow ---

    ipcMain.handle('auth:github-login', async (_event, appId: 'profile' | 'copilot' = 'copilot') => {
        return await proxyService.initiateGitHubAuth(appId)
    })

    ipcMain.handle('auth:poll-token', async (_event, deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'copilot') => {
        try {
            const response = await proxyService.waitForGitHubToken(deviceCode, interval, appId)
            const token = response.access_token

            // Determine provider based on appId
            const provider = appId === 'copilot' ? 'copilot' : 'github'

            // Create token data for linking
            const tokenData: TokenData = {
                accessToken: token,
                refreshToken: response.refresh_token,
                expiresAt: response.expires_in ? Date.now() + (response.expires_in * 1000) : undefined,
                scope: appId === 'copilot' ? 'read:user' : 'read:user user:email repo'
            }

            // Link the account using new auth system
            await authService.linkAccount(provider, tokenData)

            // Update copilot service if needed
            if (appId === 'copilot') {
                copilotService.setGithubToken(token)
            }

            return { success: true, token }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // --- New Linked Accounts API ---

    ipcMain.handle('auth:get-linked-accounts', async (_event, provider?: string) => {
        try {
            if (provider) {
                return await authService.getAccountsByProvider(provider)
            }
            return await authService.getAllAccounts()
        } catch (error) {
            console.error('Failed to get linked accounts:', error)
            return []
        }
    })

    ipcMain.handle('auth:get-active-linked-account', async (_event, provider: string) => {
        try {
            return await authService.getActiveAccount(provider)
        } catch (error) {
            console.error('Failed to get active linked account:', error)
            return null
        }
    })

    ipcMain.handle('auth:set-active-linked-account', async (_event, provider: string, accountId: string) => {
        try {
            await authService.setActiveAccount(provider, accountId)
            return { success: true }
        } catch (error) {
            console.error('Failed to set active linked account:', error)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    ipcMain.handle('auth:link-account', async (_event, provider: string, tokenData: TokenData) => {
        try {
            const account = await authService.linkAccount(provider, tokenData)
            return { success: true, account }
        } catch (error) {
            console.error('Failed to link account:', error)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    ipcMain.handle('auth:unlink-account', async (_event, accountId: string) => {
        try {
            await authService.unlinkAccount(accountId)
            return { success: true }
        } catch (error) {
            console.error('Failed to unlink account:', error)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    ipcMain.handle('auth:unlink-provider', async (_event, provider: string) => {
        try {
            await authService.unlinkAllForProvider(provider)
            return { success: true }
        } catch (error) {
            console.error('Failed to unlink provider:', error)
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    ipcMain.handle('auth:has-linked-account', async (_event, provider: string) => {
        try {
            return await authService.hasLinkedAccount(provider)
        } catch (error) {
            console.error('Failed to check linked account:', error)
            return false
        }
    })
}
