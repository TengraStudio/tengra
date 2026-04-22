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
 * Workspace Navigation Utility
 * Enables cross-component navigation to specific workspace tabs or files.
 */

export type WorkspaceNavigationAction =
    | { type: 'open_file'; path: string; line?: number; readOnly?: boolean }
    | { type: 'open_diff'; path: string };

/**
 * Dispatches a navigation event that can be caught by the WorkspaceDashboard
 */
export function navigateToWorkspace(action: WorkspaceNavigationAction): void {
    window.dispatchEvent(
        new CustomEvent('tengra:workspace-navigate', { detail: action })
    );
}

/**
 * Event name for workspace navigation
 */
export const WORKSPACE_NAVIGATE_EVENT = 'tengra:workspace-navigate';
