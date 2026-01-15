import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'

import { themeStore } from '@main/utils/theme-store.util'
import { ipcMain, shell } from 'electron'

export function registerThemeIpc(): void {
    ipcMain.handle('theme:getCurrent', async () => {
        return themeStore.getCurrentTheme()
    })

    ipcMain.handle('theme:set', async (_event, themeId: string) => {
        return themeStore.setTheme(themeId)
    })

    ipcMain.handle('theme:getAll', async () => {
        return themeStore.getAllThemes()
    })

    ipcMain.handle('theme:getDetails', async (_event, themeId: string) => {
        return themeStore.getThemeDetails(themeId)
    })

    ipcMain.handle('theme:getCustom', async () => {
        return themeStore.getCustomThemes()
    })

    ipcMain.handle('theme:addCustom', async (_event, theme) => {
        return themeStore.addCustomTheme(theme)
    })

    ipcMain.handle('theme:updateCustom', async (_event, id, updates) => {
        return themeStore.updateCustomTheme(id, updates)
    })

    ipcMain.handle('theme:deleteCustom', async (_event, id: string) => {
        return themeStore.deleteCustomTheme(id)
    })

    ipcMain.handle('theme:toggleFavorite', async (_event, themeId: string) => {
        return themeStore.toggleFavorite(themeId)
    })

    ipcMain.handle('theme:getFavorites', async () => {
        return themeStore.getFavorites()
    })

    ipcMain.handle('theme:isFavorite', async (_event, themeId: string) => {
        return themeStore.isFavorite(themeId)
    })

    ipcMain.handle('theme:getHistory', async () => {
        return themeStore.getHistory()
    })

    ipcMain.handle('theme:clearHistory', async () => {
        await themeStore.clearHistory()
        return true
    })

    ipcMain.handle('theme:getPresets', async () => {
        return themeStore.getPresets()
    })

    ipcMain.handle('theme:applyPreset', async (_event, presetId: string) => {
        return themeStore.applyPreset(presetId)
    })

    ipcMain.handle('theme:getCurrentPreset', async () => {
        return themeStore.getCurrentPreset()
    })

    ipcMain.handle('theme:clearPreset', async () => {
        await themeStore.clearPreset()
        return true
    })

    ipcMain.handle('theme:export', async (_event, themeId: string) => {
        const json = themeStore.exportTheme(themeId)
        if (!json) { return false }

        try {
            const tempPath = path.join(os.tmpdir(), `orbit-theme-${themeId}-${Date.now()}.json`)
            await fs.writeFile(tempPath, json)
            await shell.openPath(tempPath)
            return true
        } catch {
            return false
        }
    })

    ipcMain.handle('theme:import', async (_event, jsonString: string) => {
        return themeStore.importTheme(jsonString)
    })

    ipcMain.handle('theme:duplicate', async (_event, themeId, newName) => {
        return themeStore.duplicateTheme(themeId, newName)
    })
}
