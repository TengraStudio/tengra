import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
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

class ThemeStore {
    private static instance: ThemeStore | null = null
    private storePath: string
    private store: ThemeStoreData

    private constructor() {
        this.storePath = path.join(app.getPath('userData'), 'theme-store.json')
        this.store = this.loadStore()
    }

    static getInstance(): ThemeStore {
        if (!ThemeStore.instance) {
            ThemeStore.instance = new ThemeStore()
        }
        return ThemeStore.instance
    }

    private loadStore(): ThemeStoreData {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf8')
                const loaded = JSON.parse(data) as ThemeStoreData
                return { ...DEFAULT_THEME_STORE, ...loaded }
            }
        } catch {
            console.warn('[ThemeStore] Failed to load, using defaults')
        }
        return { ...DEFAULT_THEME_STORE }
    }

    private saveStore(): void {
        try {
            const tempPath = this.storePath + '.tmp'
            fs.writeFileSync(tempPath, JSON.stringify(this.store, null, 2), 'utf8')
            fs.renameSync(tempPath, this.storePath)
        } catch (error) {
            console.error('[ThemeStore] Failed to save:', error)
        }
    }

    getCurrentTheme(): string {
        return this.store.currentTheme
    }

    setTheme(themeId: string): boolean {
        const theme = getThemeById(themeId) ?? this.store.customThemes.find(t => t.id === themeId)
        if (!theme) {
            console.warn(`[ThemeStore] Theme not found: ${themeId}`)
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
        console.log(`[ThemeStore] Theme changed to: ${themeId}`)
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
        console.log(`[ThemeStore] Custom theme added: ${customTheme.id}`)
        return customTheme
    }

    updateCustomTheme(id: string, updates: Partial<CustomTheme>): boolean {
        const index = this.store.customThemes.findIndex(t => t.id === id)
        if (index === -1) {
            console.warn(`[ThemeStore] Custom theme not found: ${id}`)
            return false
        }

        this.store.customThemes[index] = {
            ...this.store.customThemes[index],
            ...updates,
            id,
            modifiedAt: Date.now()
        }
        this.saveStore()
        console.log(`[ThemeStore] Custom theme updated: ${id}`)
        return true
    }

    deleteCustomTheme(id: string): boolean {
        const index = this.store.customThemes.findIndex(t => t.id === id)
        if (index === -1) {
            console.warn(`[ThemeStore] Custom theme not found: ${id}`)
            return false
        }

        this.store.customThemes.splice(index, 1)

        if (this.store.currentTheme === id) {
            this.setTheme('graphite')
        }

        this.saveStore()
        console.log(`[ThemeStore] Custom theme deleted: ${id}`)
        return true
    }

    toggleFavorite(themeId: string): boolean {
        const index = this.store.favorites.indexOf(themeId)
        if (index === -1) {
            this.store.favorites.push(themeId)
            console.log(`[ThemeStore] Theme favorited: ${themeId}`)
        } else {
            this.store.favorites.splice(index, 1)
            console.log(`[ThemeStore] Theme unfavorited: ${themeId}`)
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
            console.warn(`[ThemeStore] Preset not found: ${presetId}`)
            return false
        }

        this.store.preset = preset
        this.setTheme(preset.themeId)
        console.log(`[ThemeStore] Preset applied: ${presetId}`)
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
            console.error('[ThemeStore] Failed to import theme:', error)
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


// Export a robust singleton getter or just the class?
// Usage in ipc/theme.ts expects 'themeStore'
// We can use a Proxy to lazy load it.

const themeStoreProxy = new Proxy({} as ThemeStore, {
    get: (_target, prop) => {
        const instance = ThemeStore.getInstance()
        return (instance as any)[prop]
    }
})

export const themeStore = themeStoreProxy
export { BUILTIN_THEMES, getThemeById }
