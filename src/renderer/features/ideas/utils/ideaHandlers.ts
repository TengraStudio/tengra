/**
 * Utility functions for handling idea operations
 */
import type { IdeaSession, WorkspaceIdea } from '@shared/types/ideas';

/**
 * Creates an optimistic update for idea status
 */
export function createOptimisticIdea(
    idea: WorkspaceIdea,
    status: 'approved' | 'rejected' | 'archived'
): WorkspaceIdea {
    return { ...idea, status };
}

/**
 * Rolls back optimistic update
 */
export function rollbackIdea(original: WorkspaceIdea): WorkspaceIdea {
    return original;
}

/**
 * Validates that required context exists for operations
 */
export function validateIdeaOperationContext(
    idea: WorkspaceIdea | null,
    session: IdeaSession | null
): idea is WorkspaceIdea {
    return idea !== null && session !== null;
}

/**
 * Constructs export filename with timestamp
 */
export function constructExportFilename(
    sessionId: string,
    format: 'markdown' | 'json'
): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = format === 'markdown' ? 'md' : 'json';
    return `ideas-${sessionId}-${timestamp}.${extension}`;
}

/**
 * Gets the MIME type for export format
 */
export function getExportMimeType(format: 'markdown' | 'json'): string {
    return format === 'markdown' ? 'text/markdown' : 'application/json';
}

/**
 * Gets the status emoji for an idea
 */
export function getStatusEmoji(status: string): string {
    switch (status) {
        case 'approved':
            return '✅';
        case 'rejected':
            return '❌';
        default:
            return '⏳';
    }
}
