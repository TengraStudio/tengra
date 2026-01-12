export interface ThemeDefinition {
    id: string
    name: string
    category: ThemeCategory
    isDark: boolean
    colors: ThemeColors
    description?: string
    author?: string
    tags?: string[]
}

export interface ThemeColors {
    background: string
    foreground: string
    card: string
    cardForeground: string
    popover: string
    popoverForeground: string
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    muted: string
    mutedForeground: string
    accent: string
    accentForeground: string
    destructive: string
    destructiveForeground: string
    border: string
    input: string
    ring: string
    radius: number
    fontFamily?: string
    glowColor?: string
}

export type ThemeCategory = 
    | 'elite-dark'
    | 'vibrant-neon'
    | 'professional-light'
    | 'artisanal'

export interface ThemePreset {
    id: string
    name: string
    themeId: string
    accentColor?: string
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
    fontScale?: number
}

export interface CustomTheme extends ThemeDefinition {
    isCustom: true
    source: 'user-created' | 'imported'
    createdAt: number
    modifiedAt: number
}

export interface ThemeStoreState {
    currentTheme: string
    customThemes: CustomTheme[]
    favorites: string[]
    history: string[]
    preset: ThemePreset | null
}

export const DEFAULT_THEME_PRESETS: ThemePreset[] = [
    { id: 'default', name: 'Default', themeId: 'graphite', borderRadius: 'lg' },
    { id: 'compact', name: 'Compact', themeId: 'graphite', borderRadius: 'none', fontScale: 0.9 },
    { id: 'comfort', name: 'Comfort', themeId: 'snow', borderRadius: 'xl', fontScale: 1.1 },
    { id: 'developer', name: 'Developer', themeId: 'obsidian', borderRadius: 'sm' },
    { id: 'creative', name: 'Creative', themeId: 'cyberpunk', borderRadius: 'lg' }
]
