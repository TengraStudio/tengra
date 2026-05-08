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
 * Dialog utilities for terminal interactions.
 * Provides wrappers around native browser dialogs to avoid eslint no-alert violations.
 */

/**
 * Display a confirmation dialog to the user
 * @param message - The message to display
 * @returns True if the user confirmed, false otherwise
 */
export async function confirmDialog(message: string): Promise<boolean> {
    const result = await window.electron.dialog.showMessageBox({
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
        message,
    });
    return result.response === 0;
}

/**
 * Display an alert dialog to the user
 * @param message - The message to display
 */
export async function alertDialog(message: string): Promise<void> {
    await window.electron.dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        message,
    });
}

/**
 * Display a prompt dialog to the user
 * @param message - The message to display
 * @param defaultValue - Optional default value
 * @returns The user input, or null if cancelled
 */
export function promptDialog(message: string, defaultValue?: string): string | null {
    // Using window.prompt is intentional for terminal interactions
    // This wrapper centralizes all prompt usage
    return window.prompt(message, defaultValue) || null;
}

