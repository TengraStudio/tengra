import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildFilesystemServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'File system operations with line-level editing capabilities',
            actions: buildActions([
                // --- Basic File Operations ---
                {
                    name: 'read',
                    description: 'Read a UTF-8 file content',
                    handler: ({ path }) => deps.filesystem.readFile(path as string)
                },
                {
                    name: 'write',
                    description: 'Write text to file (creates directories if needed)',
                    handler: ({ path, content }) => deps.filesystem.writeFile(path as string, content as string)
                },
                {
                    name: 'list',
                    description: 'List directory entries with metadata',
                    handler: ({ path }) => deps.filesystem.listDirectory(path as string)
                },
                {
                    name: 'exists',
                    description: 'Check if file or directory exists',
                    handler: ({ path }) => deps.filesystem.fileExists(path as string)
                },
                {
                    name: 'info',
                    description: 'Get detailed file/directory information',
                    handler: ({ path }) => deps.filesystem.getFileInfo(path as string)
                },
                {
                    name: 'mkdir',
                    description: 'Create a directory (recursive)',
                    handler: ({ path }) => deps.filesystem.createDirectory(path as string)
                },
                {
                    name: 'delete',
                    description: 'Delete a file',
                    handler: ({ path }) => deps.filesystem.deleteFile(path as string)
                },
                {
                    name: 'deleteDir',
                    description: 'Delete a directory recursively',
                    handler: ({ path }) => deps.filesystem.deleteDirectory(path as string)
                },
                {
                    name: 'copy',
                    description: 'Copy a file',
                    handler: ({ source, destination }) => deps.filesystem.copyFile(source as string, destination as string)
                },
                {
                    name: 'move',
                    description: 'Move/rename a file or directory',
                    handler: ({ source, destination }) => deps.filesystem.moveFile(source as string, destination as string)
                },

                // --- Line-Level Editing (AI-friendly) ---
                {
                    name: 'readLines',
                    description: 'Read specific lines from a file',
                    handler: async ({ path, startLine, endLine }) => {
                        const result = await deps.filesystem.readFile(path as string);
                        if (!result.success || !result.data) {
                            return { success: false, error: result.error ?? 'Failed to read file' };
                        }
                        const lines = result.data.split('\n');
                        const start = Math.max(0, (startLine as number) - 1);
                        const end = Math.min(lines.length, endLine as number);
                        const selectedLines = lines.slice(start, end);
                        return {
                            success: true,
                            data: {
                                lines: selectedLines,
                                lineNumbers: selectedLines.map((_, i) => start + i + 1),
                                totalLines: lines.length
                            }
                        };
                    }
                },
                {
                    name: 'replaceLine',
                    description: 'Replace a single line in a file',
                    handler: async ({ path, lineNumber, content }) => {
                        const result = await deps.filesystem.readFile(path as string);
                        if (!result.success || !result.data) {
                            return { success: false, error: result.error ?? 'Failed to read file' };
                        }
                        const lines = result.data.split('\n');
                        const index = (lineNumber as number) - 1;
                        if (index < 0 || index >= lines.length) {
                            return { success: false, error: `Line ${lineNumber} does not exist. File has ${lines.length} lines.` };
                        }
                        lines[index] = content as string;
                        return deps.filesystem.writeFile(path as string, lines.join('\n'));
                    }
                },
                {
                    name: 'insertLine',
                    description: 'Insert a new line at specific position',
                    handler: async ({ path, lineNumber, content }) => {
                        const result = await deps.filesystem.readFile(path as string);
                        if (!result.success || !result.data) {
                            return { success: false, error: result.error ?? 'Failed to read file' };
                        }
                        const lines = result.data.split('\n');
                        const index = (lineNumber as number) - 1;
                        if (index < 0 || index > lines.length) {
                            return { success: false, error: `Invalid line number ${lineNumber}. File has ${lines.length} lines.` };
                        }
                        lines.splice(index, 0, content as string);
                        return deps.filesystem.writeFile(path as string, lines.join('\n'));
                    }
                },
                {
                    name: 'deleteLine',
                    description: 'Delete a specific line from a file',
                    handler: async ({ path, lineNumber }) => {
                        const result = await deps.filesystem.readFile(path as string);
                        if (!result.success || !result.data) {
                            return { success: false, error: result.error ?? 'Failed to read file' };
                        }
                        const lines = result.data.split('\n');
                        const index = (lineNumber as number) - 1;
                        if (index < 0 || index >= lines.length) {
                            return { success: false, error: `Line ${lineNumber} does not exist. File has ${lines.length} lines.` };
                        }
                        lines.splice(index, 1);
                        return deps.filesystem.writeFile(path as string, lines.join('\n'));
                    }
                },
                {
                    name: 'applyEdits',
                    description: 'Apply multiple line edits to a file atomically',
                    handler: ({ path, edits }) => deps.filesystem.applyEdits(path as string, edits as Array<{
                        startLine: number;
                        endLine: number;
                        replacement: string;
                    }>)
                },
                {
                    name: 'searchInFile',
                    description: 'Search for text in a file and return matching line numbers',
                    handler: async ({ path, pattern, caseSensitive }) => {
                        const result = await deps.filesystem.readFile(path as string);
                        if (!result.success || !result.data) {
                            return { success: false, error: result.error ?? 'Failed to read file' };
                        }
                        const lines = result.data.split('\n');
                        const searchPattern = caseSensitive ? pattern : (pattern as string).toLowerCase();
                        const matches = lines
                            .map((line, index) => ({
                                lineNumber: index + 1,
                                line: line,
                                matches: caseSensitive
                                    ? line.includes(pattern as string)
                                    : line.toLowerCase().includes(searchPattern as string)
                            }))
                            .filter(m => m.matches);
                        return {
                            success: true,
                            data: {
                                matches,
                                totalMatches: matches.length
                            }
                        };
                    }
                },

                // --- File Management ---
                {
                    name: 'unzip',
                    description: 'Extract a zip archive',
                    handler: ({ zipPath, destPath }) => deps.filesystem.unzip(zipPath as string, destPath as string)
                },
                {
                    name: 'download',
                    description: 'Download a file from URL',
                    handler: ({ url, destPath }) => deps.filesystem.downloadFile(url as string, destPath as string)
                },
                {
                    name: 'getHash',
                    description: 'Calculate file hash (md5, sha1, sha256)',
                    handler: ({ path, algorithm }) => deps.filesystem.getFileHash(
                        path as string,
                        algorithm as 'md5' | 'sha1' | 'sha256'
                    )
                },
                {
                    name: 'searchFiles',
                    description: 'Search for files by name pattern',
                    handler: ({ rootPath, pattern }) => deps.filesystem.searchFiles(rootPath as string, pattern as string)
                }
            ])
        }
    ];
}
