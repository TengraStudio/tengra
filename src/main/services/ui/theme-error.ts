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
 * Standardized error codes and typed error class for ThemeService.
 */

/**
 * Discriminated error codes for all theme-related failures.
 */
export enum ThemeErrorCode {
    NOT_FOUND = 'THEME_NOT_FOUND',
    INVALID_ID = 'THEME_INVALID_ID',
    INVALID_NAME = 'THEME_INVALID_NAME',
    INVALID_COLORS = 'THEME_INVALID_COLORS',
    DUPLICATE_ID = 'THEME_DUPLICATE_ID',
    INVALID_FORMAT = 'THEME_INVALID_FORMAT',
    SAVE_FAILED = 'THEME_SAVE_FAILED',
    LOAD_FAILED = 'THEME_LOAD_FAILED',
    IMPORT_FAILED = 'THEME_IMPORT_FAILED',
    PRESET_NOT_FOUND = 'THEME_PRESET_NOT_FOUND',
}

/**
 * Typed error class for theme failures.
 * Always carries a ThemeErrorCode for programmatic handling.
 */
export class ThemeError extends Error {
    public readonly code: ThemeErrorCode;

    constructor(code: ThemeErrorCode, message: string) {
        super(message);
        this.name = 'ThemeError';
        this.code = code;
    }
}

/** Maximum allowed length for a theme name. */
export const MAX_THEME_NAME_LENGTH = 100;

/** Maximum allowed length for a theme ID. */
export const MAX_THEME_ID_LENGTH = 128;

/** Regex pattern for valid theme IDs (alphanumeric, hyphens, underscores). */
export const THEME_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/;

/** Required color keys that must be present in a valid ThemeColors object. */
export const REQUIRED_COLOR_KEYS: readonly string[] = [
    'background',
    'foreground',
    'border',
    'input',
    'ring',
] as const;
