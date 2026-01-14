import { CopilotService } from '@main/services/llm/copilot.service'
import { ProxyService } from '@main/services/proxy/proxy.service'
import { SettingsService } from '@main/services/settings.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { ipcMain } from 'electron'


export function registerAuthIpc(proxyService: ProxyService, settingsService: SettingsService, copilotService: CopilotService) {
    ipcMain.handle('auth:github-login', async (_event, appId: 'profile' | 'copilot' = 'copilot') => {
        // startLoginFlow was essentially initiateGitHubAuth
        return await proxyService.initiateGitHubAuth(appId)
    })

    ipcMain.handle('auth:poll-token', async (_event, deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'copilot') => {
        try {
            const token = await proxyService.waitForGitHubToken(deviceCode, interval, appId)
            const settings = settingsService.getSettings()

            // Always save to github.token providing it's the main login
            // And if it's copilot capable, save to copilot too.
            // Since we default to 'copilot', this token is good for everything.

            const newSettings = {
                ...settings,
                github: {
                    ...settings.github,
                    token: token,
                    username: settings.github?.username // We don't have username here yet, profile service fetches it later
                },
                copilot: appId === 'copilot' ? {
                    ...settings.copilot,
                    connected: true,
                    token: token
                } : settings.copilot
            };

            settingsService.saveSettings(newSettings);

            if (appId === 'copilot') {
                copilotService.setGithubToken(token)
            }

            return { success: true, token }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })
}
