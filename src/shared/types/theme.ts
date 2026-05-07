/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Theme System Types - VSCode Compatible
 * Based on VSCode's theme extension API for extension compatibility
 */

export type ThemeType = 'light' | 'dark' | 'highContrast';

export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;

    // Extended feedback colors
    success?: string;
    successForeground?: string;
    successLight?: string;
    warning?: string;
    warningForeground?: string;
    warningLight?: string;
    info?: string;
    infoForeground?: string;
    infoLight?: string;
    error?: string;
    errorForeground?: string;

    // Monaco editor token colors (HSL tokens)
    editorBackground?: string;
    editorForeground?: string;
    editorGutterBackground?: string;
    editorLineNumber?: string;
    editorLineNumberActive?: string;
    editorCursor?: string;
    editorSelection?: string;
    editorSelectionInactive?: string;
    editorLineHighlight?: string;
    editorWidgetBackground?: string;
    editorWidgetBorder?: string;
    editorIndentGuide?: string;
    editorIndentGuideActive?: string;
    editorTokenComment?: string;
    editorTokenKeyword?: string;
    editorTokenString?: string;
    editorTokenNumber?: string;
    editorTokenType?: string;
    editorTokenInvalid?: string;

    // Neutral shades
    neutral?: string;
    neutralLight?: string;
    neutralDark?: string;

    border: string;
    input: string;
    ring: string;
    radius?: number;
    fontFamily?: string;
    glowColor?: string;
    shadowColor?: string;
}

/**
 * Theme CSS variable overrides.
 *
 * Keys are CSS custom property names **without** the leading `--` (kebab-case),
 * e.g. `"tengra-container-padding": "2rem"`, `"blur-1px": "1px"`.
 *
 * This exists to support full theming beyond the limited `colors` schema
 * (layout, radius, spacing, shadows, typography, etc.).
 */
export type ThemeVars = Record<string, string>;

/**
 * Theme Manifest - VSCode compatible structure
 * Allows declarative theme definitions for extension distribution
 */
export interface ThemeManifest {
    // Required metadata
    id: string;
    name: string;
    displayName: string;
    description?: string;
    author?: string;
    version: string;

    // Theme classification (KEY: for light/dark detection)
    type: ThemeType;

    // Visual
    colors: ThemeColors;
    vars?: ThemeVars;
    preview?: string; // Preview image URL or color

    // Distribution metadata 
    downloads?: number;
    rating?: number;
    isPremium?: boolean;
    isInstalled?: boolean;
    publisher?: string;
    repository?: string;
    license?: string;
    tags?: string[];
}

/**
 * Legacy support - keep for backward compatibility
 */
export interface ThemeDefinition {
    id: string;
    name: string;
    isDark: boolean;
    colors: ThemeColors;
    description?: string;
    author?: string;
    tags?: string[];
}

export interface ThemePreset {
    id: string;
    name: string;
    themeId: string;
    accentColor?: string;
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    fontScale?: number;
}

export interface CustomTheme extends ThemeDefinition {
    isCustom: true;
    source: 'user-created' | 'imported';
    createdAt: number;
    modifiedAt: number;
}

export interface ThemeStoreState {
    currentTheme: string;
    customThemes: CustomTheme[];
    favorites: string[];
    history: string[];
    preset: ThemePreset | null;
}
/**
 * Theme Registry
 * Maps theme ID to manifest
 */
export type ThemeRegistry = Record<string, ThemeManifest>;

