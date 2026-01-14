import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { BaseService } from '@main/services/base.service'
import { BUILTIN_THEMES, getThemeById } from '@main/utils/theme-constants'
import { CustomTheme, ThemePreset, DEFAULT_THEME_PRESETS } from '@shared/types/theme'

interface ThemeStoreData {
    currentTheme: string
    customThemes: CustomTheme[]
    favorites: string[]
    history: string[]
    preset: ThemePreset | null
}

const DEFAULT_THEME_STORE: ThemeStoreData = {
    currentTheme: 'graphite',
    customThemes: [],
    favorites: [],
    history: ['graphite'],
    preset: null
}

export class ThemeService extends BaseService {
    private storePath: string
    private store: ThemeStoreData

    constructor() {
        super('ThemeService')
        this.storePath = path.join(app.getPath('userData'), 'theme-store.json')
        this.store = this.loadStore()
    }

    private loadStore(): ThemeStoreData {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf8')
                const loaded = JSON.parse(data) as ThemeStoreData
                return { ...DEFAULT_THEME_STORE, ...loaded }
            }
        } catch (error) {
            this.logWarn('Failed to load theme store, using defaults', error)
        }
        return { ...DEFAULT_THEME_STORE }
    }

    private saveStore(): void {
        try {
            const tempPath = this.storePath + '.tmp'
            fs.writeFileSync(tempPath, JSON.stringify(this.store, null, 2), 'utf8')
            fs.renameSync(tempPath, this.storePath)
        } catch (error) {
            this.logError('Failed to save theme store', error)
        }
    }

    getCurrentTheme(): string {
        return this.store.currentTheme
    }

    setTheme(themeId: string): boolean {
        const theme = getThemeById(themeId) ?? this.store.customThemes.find(t => t.id === themeId)
        if (!theme) {
            this.logWarn(`Theme not found: ${themeId}`)
            return false
        }

        const previousTheme = this.store.currentTheme
        this.store.currentTheme = themeId

        if (!this.store.history.includes(themeId)) {
            this.store.history.push(themeId)
            if (this.store.history.length > 20) {
                this.store.history.shift()
            }
        }

        if (previousTheme !== themeId && !this.store.history.includes(previousTheme)) {
            this.store.history.push(previousTheme)
        }

        this.saveStore()
        this.logInfo(`Theme changed to: ${themeId}`)
        return true
    }

    getAllThemes(): Array<{ id: string; name: string; isDark: boolean; isCustom?: boolean }> {
        const builtin = BUILTIN_THEMES.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark
        }))
        const custom = this.store.customThemes.map(t => ({
            id: t.id,
            name: t.name,
            isDark: t.isDark,
            isCustom: true
        }))
        return [...builtin, ...custom]
    }

    getThemeDetails(themeId: string) {
        const builtin = getThemeById(themeId)
        if (builtin) {
            return { ...builtin, isBuiltIn: true }
        }
        const custom = this.store.customThemes.find(t => t.id === themeId)
        if (custom) {
            return { ...custom, isBuiltIn: false }
        }
        return null
    }

    getCustomThemes(): CustomTheme[] {
        return [...this.store.customThemes]
    }

    addCustomTheme(theme: Omit<CustomTheme, 'id' | 'createdAt' | 'modifiedAt'>): CustomTheme {
        const customTheme: CustomTheme = {
            ...theme,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        }
        this.store.customThemes.push(customTheme)
        this.saveStore()
        this.logInfo(`Custom theme added: ${customTheme.id}`)
        return customTheme
    }

    updateCustomTheme(id: string, updates: Partial<CustomTheme>): boolean {
        const index = this.store.customThemes.findIndex(t => t.id === id)
        if (index === -1) {
            this.logWarn(`Custom theme not found for update: ${id}`)
            return false
        }

        this.store.customThemes[index] = {
            ...this.store.customThemes[index],
            ...updates,
            id,
            modifiedAt: Date.now()
        }
        this.saveStore()
        this.logInfo(`Custom theme updated: ${id}`)
        return true
    }

    deleteCustomTheme(id: string): boolean {
        const index = this.store.customThemes.findIndex(t => t.id === id)
        if (index === -1) {
            this.logWarn(`Custom theme not found for deletion: ${id}`)
            return false
        }

        this.store.customThemes.splice(index, 1)

        if (this.store.currentTheme === id) {
            this.setTheme('graphite')
        }

        this.saveStore()
        this.logInfo(`Custom theme deleted: ${id}`)
        return true
    }

    toggleFavorite(themeId: string): boolean {
        const index = this.store.favorites.indexOf(themeId)
        if (index === -1) {
            this.store.favorites.push(themeId)
            this.logInfo(`Theme favorited: ${themeId}`)
        } else {
            this.store.favorites.splice(index, 1)
            this.logInfo(`Theme unfavorited: ${themeId}`)
        }
        this.saveStore()
        return this.store.favorites.includes(themeId)
    }

    getFavorites(): string[] {
        return [...this.store.favorites]
    }

    isFavorite(themeId: string): boolean {
        return this.store.favorites.includes(themeId)
    }

    getHistory(): string[] {
        return [...this.store.history]
    }

    clearHistory(): void {
        this.store.history = []
        this.saveStore()
    }

    getPresets(): ThemePreset[] {
        return [...DEFAULT_THEME_PRESETS]
    }

    getPreset(id: string): ThemePreset | undefined {
        return DEFAULT_THEME_PRESETS.find(p => p.id === id)
    }

    applyPreset(presetId: string): boolean {
        const preset = this.getPreset(presetId)
        if (!preset) {
            this.logWarn(`Preset not found: ${presetId}`)
            return false
        }

        this.store.preset = preset
        this.setTheme(preset.themeId)
        this.logInfo(`Preset applied: ${presetId}`)
        return true
    }

    getCurrentPreset(): ThemePreset | null {
        return this.store.preset
    }

    clearPreset(): void {
        this.store.preset = null
        this.saveStore()
    }

    exportTheme(themeId: string): string | null {
        const theme = this.getThemeDetails(themeId)
        if (!theme) {
            return null
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            theme
        }
        return JSON.stringify(exportData, null, 2)
    }

    importTheme(jsonString: string): CustomTheme | null {
        try {
            const data = JSON.parse(jsonString)
            if (data.version !== '1.0' || !data.theme) {
                throw new Error('Invalid theme format')
            }

            const theme = data.theme
            if (!theme.id || !theme.name || !theme.colors) {
                throw new Error('Missing required theme properties')
            }

            if (getThemeById(theme.id) || this.store.customThemes.some(t => t.id === theme.id)) {
                throw new Error('Theme ID already exists')
            }

            return this.addCustomTheme({
                ...theme,
                isCustom: true,
                source: 'imported'
            })
        } catch (error) {
            this.logError('Failed to import theme', error)
            return null
        }
    }

    duplicateTheme(themeId: string, newName: string): CustomTheme | null {
        const original = this.getThemeDetails(themeId)
        if (!original || 'isBuiltIn' in original) {
            return null
        }

        const originalTyped = original as CustomTheme
        return this.addCustomTheme({
            ...originalTyped,
            name: newName,
            isCustom: true,
            source: 'user-created'
        })
    }
}
