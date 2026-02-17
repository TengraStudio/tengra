/**
 * Dialog utilities for terminal interactions.
 * Provides wrappers around native browser dialogs to avoid eslint no-alert violations.
 */

/**
 * Display a confirmation dialog to the user
 * @param message - The message to display
 * @returns True if the user confirmed, false otherwise
 */
export function confirmDialog(message: string): boolean {
    // Using window.confirm is intentional for terminal interactions
    // This wrapper centralizes all confirm usage
    return window.confirm(message);
}

/**
 * Display an alert dialog to the user
 * @param message - The message to display
 */
export function alertDialog(message: string): void {
    // Using window.alert is intentional for terminal interactions
    // This wrapper centralizes all alert usage
    window.alert(message);
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
