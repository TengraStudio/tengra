/**
 * @fileoverview Input validation and schema guards for Workspace Explorer
 * @description Provides Zod schemas and validation utilities for type-safe workspace operations
 */

import { z } from 'zod';

/**
 * Schema for validating workspace mount types
 */
export const WorkspaceMountTypeSchema = z.enum(['local', 'ssh']);

/**
 * Schema for validating SSH configuration
 */
export const WorkspaceSshConfigSchema = z.object({
    host: z.string().min(1, 'error.workspace.validation.host_required'),
    port: z.number().int().min(1).max(65535).optional(),
    username: z.string().min(1, 'error.workspace.validation.username_required'),
    authType: z.enum(['password', 'key']).optional(),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    passphrase: z.string().optional(),
});

/**
 * Schema for validating a workspace mount
 */
export const WorkspaceMountSchema = z.object({
    id: z.string().min(1, 'error.workspace.validation.mount_id_required'),
    name: z.string().min(1, 'error.workspace.validation.mount_name_required'),
    type: WorkspaceMountTypeSchema,
    rootPath: z.string().min(1, 'error.workspace.validation.root_path_required'),
    ssh: WorkspaceSshConfigSchema.optional(),
});

/**
 * Schema for validating a workspace entry (base without children for recursion)
 */
const WorkspaceEntryBaseSchema = z.object({
    name: z.string().min(1, 'error.workspace.validation.entry_name_required'),
    path: z.string().min(1, 'error.workspace.validation.entry_path_required'),
    isDirectory: z.boolean(),
    mountId: z.string().min(1, 'error.workspace.validation.mount_id_required'),
    size: z.number().int().nonnegative().optional(),
    lastModified: z.date().optional(),
    initialLine: z.number().int().nonnegative().optional(),
});

/**
 * Schema for validating a workspace entry with children (recursive)
 */
export type WorkspaceEntryType = z.infer<typeof WorkspaceEntryBaseSchema> & {
    children?: WorkspaceEntryType[];
};

/**
 * Schema for validating a workspace entry
 */
export const WorkspaceEntrySchema: z.ZodType<WorkspaceEntryType> = WorkspaceEntryBaseSchema.extend({
    children: z.lazy(() => z.array(WorkspaceEntrySchema)).optional(),
});

/**
 * Schema for validating mount status
 */
export const MountStatusSchema = z.enum(['connected', 'disconnected', 'connecting']);

/**
 * Schema for validating context menu actions
 */
export const ContextMenuActionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('createFile'), entry: WorkspaceEntrySchema }),
    z.object({ type: z.literal('createFolder'), entry: WorkspaceEntrySchema }),
    z.object({ type: z.literal('rename'), entry: WorkspaceEntrySchema }),
    z.object({ type: z.literal('delete'), entry: WorkspaceEntrySchema }),
]);

/**
 * Schema for validating context menu state
 */
export const ContextMenuStateSchema = z.object({
    x: z.number(),
    y: z.number(),
    entry: WorkspaceEntrySchema.optional(),
    mountId: z.string().optional(),
});

/**
 * Type guard to check if a value is a valid WorkspaceMount
 */
export function isValidWorkspaceMount(value: RendererDataValue): value is z.infer<typeof WorkspaceMountSchema> {
    const result = WorkspaceMountSchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid WorkspaceEntry
 */
export function isValidWorkspaceEntry(value: RendererDataValue): value is z.infer<typeof WorkspaceEntrySchema> {
    const result = WorkspaceEntrySchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid MountStatus
 */
export function isValidMountStatus(value: RendererDataValue): value is z.infer<typeof MountStatusSchema> {
    const result = MountStatusSchema.safeParse(value);
    return result.success;
}

/**
 * Type guard to check if a value is a valid ContextMenuAction
 */
export function isValidContextMenuAction(value: RendererDataValue): value is z.infer<typeof ContextMenuActionSchema> {
    const result = ContextMenuActionSchema.safeParse(value);
    return result.success;
}

/**
 * Validates a path string for security
 * @param path - The path to validate
 * @returns True if the path is safe
 */
export function isPathSafe(path: string): boolean {
    // Check for path traversal attempts
    if (path.includes('..')) {
        return false;
    }

    // Check for null bytes
    if (path.includes('\0')) {
        return false;
    }

    // Check for absolute path attempts on Windows
    if (/^[a-zA-Z]:/.test(path)) {
        // Allow if it's a valid absolute path format
        return true;
    }

    return true;
}

/**
 * Sanitizes a file name by removing dangerous characters
 * @param name - The file name to sanitize
 * @returns Sanitized file name
 */
export function sanitizeFileName(name: string): string {
    // Remove null bytes
    let sanitized = name.replace(/\0/g, '');

    // Remove ASCII control characters without control-char regex.
    sanitized = Array.from(sanitized)
        .filter(char => {
            const code = char.charCodeAt(0);
            return !(code <= 31 || code === 127);
        })
        .join('');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    const MAX_NAME_LENGTH = 255;
    if (sanitized.length > MAX_NAME_LENGTH) {
        sanitized = sanitized.substring(0, MAX_NAME_LENGTH);
    }

    return sanitized;
}

/**
 * Validates a file path for creation
 * @param parentPath - The parent directory path
 * @param name - The new file/folder name
 * @returns Validation result
 */
export function validateNewEntry(
    parentPath: string,
    name: string
): { success: boolean; error?: string; path?: string } {
    // Validate parent path
    if (!parentPath || typeof parentPath !== 'string') {
        return { success: false, error: 'error.workspace.validation.invalid_parent_path' };
    }

    // Validate name
    if (!name || typeof name !== 'string') {
        return { success: false, error: 'error.workspace.validation.name_required' };
    }

    // Sanitize name
    const sanitizedName = sanitizeFileName(name);
    if (sanitizedName.length === 0) {
        return { success: false, error: 'error.workspace.validation.invalid_name' };
    }

    // Check for reserved names
    const reservedNames = ['.', '..', 'CON', 'PRN', 'AUX', 'NUL'];
    if (reservedNames.includes(sanitizedName.toUpperCase())) {
        return { success: false, error: 'error.workspace.validation.reserved_name_not_allowed' };
    }

    // Build full path
    const separator = parentPath.endsWith('/') ? '' : '/';
    const fullPath = `${parentPath}${separator}${sanitizedName}`;

    // Validate the resulting path
    if (!isPathSafe(fullPath)) {
        return { success: false, error: 'error.workspace.validation.invalid_path' };
    }

    return { success: true, path: fullPath };
}

/**
 * Error codes for workspace explorer operations
 */
export const WorkspaceExplorerErrorCodes = {
    INVALID_MOUNT_ID: 'INVALID_MOUNT_ID',
    INVALID_ENTRY_PATH: 'INVALID_ENTRY_PATH',
    MOUNT_NOT_FOUND: 'MOUNT_NOT_FOUND',
    ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
    INVALID_PATH: 'INVALID_PATH',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
} as const;

export type WorkspaceExplorerErrorCode =
    (typeof WorkspaceExplorerErrorCodes)[keyof typeof WorkspaceExplorerErrorCodes];

/**
 * Custom error class for workspace explorer errors
 */
export class WorkspaceExplorerError extends Error {
    constructor(
        message: string,
        public readonly code: WorkspaceExplorerErrorCode,
        public readonly details?: Record<string, RendererDataValue>
    ) {
        super(message);
        this.name = 'WorkspaceExplorerError';
    }
}

/**
 * Validates mount connection parameters
 * @param mount - The mount to validate
 * @returns Validation result
 */
export function validateMountConnection(
    mount: z.infer<typeof WorkspaceMountSchema>
): { success: boolean; error?: WorkspaceExplorerError } {
    // Validate mount structure
    const result = WorkspaceMountSchema.safeParse(mount);
    if (!result.success) {
        return {
            success: false,
            error: new WorkspaceExplorerError(
                'error.workspace.validation.invalid_mount_configuration',
                WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
                { issues: result.error.issues }
            ),
        };
    }

    // Validate SSH configuration if present
    if (mount.type === 'ssh' && mount.ssh) {
        if (!mount.ssh.host) {
            return {
                success: false,
                error: new WorkspaceExplorerError(
                    'error.workspace.validation.ssh_host_required',
                    WorkspaceExplorerErrorCodes.VALIDATION_ERROR
                ),
            };
        }

        if (!mount.ssh.username) {
            return {
                success: false,
                error: new WorkspaceExplorerError(
                    'error.workspace.validation.ssh_username_required',
                    WorkspaceExplorerErrorCodes.VALIDATION_ERROR
                ),
            };
        }
    }

    return { success: true };
}

/**
 * Validates entry selection
 * @param entry - The entry to validate
 * @param mountId - The expected mount ID
 * @returns Validation result
 */
export function validateEntrySelection(
    entry: RendererDataValue,
    mountId?: string
): { success: boolean; error?: WorkspaceExplorerError; data?: z.infer<typeof WorkspaceEntrySchema> } {
    // Validate entry structure
    const result = WorkspaceEntrySchema.safeParse(entry);
    if (!result.success) {
        return {
            success: false,
            error: new WorkspaceExplorerError(
                'error.workspace.validation.invalid_entry',
                WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
                { issues: result.error.issues }
            ),
        };
    }

    // Validate mount ID if provided
    if (mountId !== undefined && result.data.mountId !== mountId) {
        return {
            success: false,
            error: new WorkspaceExplorerError(
                'error.workspace.validation.entry_mount_id_mismatch',
                WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
                { expected: mountId, actual: result.data.mountId }
            ),
        };
    }

    return { success: true, data: result.data };
}

/**
 * Maximum limits for workspace operations
 */
export const WorkspaceLimits = {
    maxMounts: 50,
    maxPathLength: 4096,
    maxNameLength: 255,
    maxEntriesPerDirectory: 10000,
    maxRecursionDepth: 100,
} as const;

/**
 * Checks if limits are exceeded
 * @param count - Current count
 * @param limit - Maximum limit
 * @param name - Name for error message
 * @returns Error if limit exceeded, undefined otherwise
 */
export function checkLimit(
    count: number,
    limit: number,
    name: string
): WorkspaceExplorerError | undefined {
    if (count > limit) {
        return new WorkspaceExplorerError(
            'error.workspace.validation.limit_exceeded',
            WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
            { count, limit, name }
        );
    }
    return undefined;
}
