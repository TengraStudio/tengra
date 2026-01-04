import { ipcMain } from 'electron'
import { ProxyService } from '../services/proxy.service'
import { CopilotService } from '../services/copilot.service'
import { SettingsService } from '../services/settings.service'

export function registerAuthIpc(proxyService: ProxyService, settingsService: SettingsService, copilotService: CopilotService) {
    ipcMain.handle('auth:github-login', async (_event, appId: 'profile' | 'copilot' = 'profile') => {
        // startLoginFlow was essentially requestGitHubDeviceCode
        return await proxyService.requestGitHubDeviceCode(appId)
    })

    ipcMain.handle('auth:poll-token', async (_event, deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile') => {
        try {
            const token = await proxyService.pollForGitHubToken(deviceCode, interval, appId)
            const settings = settingsService.getSettings()

            if (appId === 'copilot') {
                settingsService.saveSettings({
                    copilot: {
                        ...settings.copilot,
                        connected: true,
                        token: token
                    }
                })
                copilotService.setGithubToken(token)
            } else {
                settingsService.saveSettings({
                    github: {
                        username: settings.github?.username || '',
                        token: token
                    }
                })
            }

            return { success: true, token }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })
}
