import { buildActions, McpDeps, validateString, validateNumber, withTimeout, withRateLimit } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

/**
 * Validates git branch name format
 */
const validateBranchName = (branch: unknown): string => {
    const name = validateString(branch, 255).trim();

    // Git branch name validation rules
    if (!name) {
        throw new Error('Branch name is required');
    }

    // Prevent dangerous branch names
    if (name.includes('..') || name.startsWith('-') || name.endsWith('.lock')) {
        throw new Error('Invalid branch name format');
    }

    // Only allow safe characters
    if (!/^[a-zA-Z0-9/_.-]+$/.test(name)) {
        throw new Error('Branch name contains invalid characters');
    }

    return name;
};

/**
 * Validates git commit message
 */
const validateCommitMessage = (message: unknown): string => {
    const msg = validateString(message, 10000).trim();

    if (!msg) {
        throw new Error('Commit message is required');
    }

    // Prevent potential command injection via newlines with commands
    const lines = msg.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('--')) {
            throw new Error('Commit message cannot contain lines starting with --');
        }
    }

    return msg;
};

/**
 * Validates file path for git operations
 */
const validateFilePath = (file: unknown): string => {
    const filePath = validateString(file, 1000);

    // Prevent path traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
        throw new Error('Invalid file path');
    }

    return filePath;
};

export function buildGitServer(deps: McpDeps): McpService {
    return {
        name: 'git',
        description: 'Git version control operations',
        actions: buildActions([
            {
                name: 'status',
                description: 'Get git status',
                handler: ({ cwd }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.getStatus(validateString(cwd)),
                        30000
                    )
                )
            },
            {
                name: 'diff',
                description: 'Get file diff',
                handler: ({ cwd, file, staged }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.getUnifiedDiff(
                            validateString(cwd),
                            validateFilePath(file),
                            Boolean(staged)
                        ),
                        30000
                    )
                )
            },
            {
                name: 'log',
                description: 'Get commit log (max 100 commits)',
                handler: ({ cwd, count }) => {
                    const validCount = count !== undefined
                        ? validateNumber(count, 1, 100)
                        : 10;

                    return withRateLimit(
                        deps,
                        'git',
                        () => withTimeout(
                            () => deps.git.getLog(validateString(cwd), validCount),
                            30000
                        )
                    );
                }
            },
            {
                name: 'commit',
                description: 'Commit changes with validated message',
                handler: ({ cwd, message }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.commit(
                            validateString(cwd),
                            validateCommitMessage(message)
                        ),
                        30000
                    )
                )
            },
            {
                name: 'add',
                description: 'Add files to stage',
                handler: ({ cwd, files }) => {
                    const filesToAdd = files
                        ? validateFilePath(files)
                        : '.';

                    return withRateLimit(
                        deps,
                        'git',
                        () => withTimeout(
                            () => deps.git.add(validateString(cwd), filesToAdd),
                            30000
                        )
                    );
                }
            },
            {
                name: 'push',
                description: 'Push changes to remote',
                handler: ({ cwd, remote, branch }) => {
                    const validRemote = remote
                        ? validateString(remote, 100)
                        : 'origin';
                    const validBranch = branch
                        ? validateBranchName(branch)
                        : 'main';

                    return withRateLimit(
                        deps,
                        'git',
                        () => withTimeout(
                            () => deps.git.push(
                                validateString(cwd),
                                validRemote,
                                validBranch
                            ),
                            60000 // 1 minute timeout for push
                        )
                    );
                }
            },
            {
                name: 'pull',
                description: 'Pull changes from remote',
                handler: ({ cwd }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.pull(validateString(cwd)),
                        60000 // 1 minute timeout for pull
                    )
                )
            },
            {
                name: 'checkout',
                description: 'Checkout branch with validation',
                handler: ({ cwd, branch }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.checkout(
                            validateString(cwd),
                            validateBranchName(branch)
                        ),
                        30000
                    )
                )
            },
            {
                name: 'branches',
                description: 'List git branches',
                handler: ({ cwd }) => withRateLimit(
                    deps,
                    'git',
                    () => withTimeout(
                        () => deps.git.getBranches(validateString(cwd)),
                        30000
                    )
                )
            }
        ], 'git', deps.auditLog)
    };
}
