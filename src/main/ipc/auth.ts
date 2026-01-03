import { ipcMain } from 'electron'
import { AuthService } from '../services/auth.service'
import { CopilotService } from '../services/copilot.service'
import { SettingsService } from '../services/settings.service'

export function registerAuthIpc(authService: AuthService, settingsService: SettingsService, copilotService: CopilotService) {
    ipcMain.handle('auth:github-login', async (_event, appId: 'profile' | 'copilot' = 'profile') => {
        return await authService.startLoginFlow(appId)
    })

    ipcMain.handle('auth:poll-token', async (_event, deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile') => {
        try {
            const token = await authService.pollForToken(deviceCode, interval, appId)
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
                // We do NOT set copilot token here as Orbit ID doesn't work for chat
            }

            return { success: true, token }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })
}
