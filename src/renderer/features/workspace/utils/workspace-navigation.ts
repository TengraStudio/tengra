/**
 * Workspace Navigation Utility
 * Enables cross-component navigation to specific workspace tabs or files.
 */

export type WorkspaceNavigationAction =
    | { type: 'open_file'; path: string; line?: number }
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
