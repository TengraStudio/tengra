import { ToolDefinition } from '@shared/types/chat';

export const toolDefinitions: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'resolve_path',
            description: 'Resolves user-facing paths such as %USERPROFILE%/Desktop/projects, ~/Desktop, Desktop/projects, or relative workspace paths into an absolute path and reports whether the path and parent exist. Use before creating nested project folders when the parent path is ambiguous.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to resolve. Supports %VAR%, $env:VAR, $VAR, ~, and common home-relative folders like Desktop/projects.'
                    },
                    basePath: {
                        type: 'string',
                        description: 'Optional base path for relative paths. Use the active workspace root when available.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Reads the content of the file at the specified path. Use for text files.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the file to be read. Prefer direct Windows environment-variable paths like %USERPROFILE%/Desktop. Only use get_system_info if direct access fails or you truly need host metadata.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: 'Writes a file to the specified path or updates an existing file. Use this when the user asks you to create local code/files; do not dump code into chat instead.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the file to be written'
                    },
                    content: {
                        type: 'string',
                        description: 'Content to be written to the file'
                    }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_files',
            description: 'Writes multiple text files in one bounded operation. Use for creating apps/projects with several files instead of sending code blocks in chat or calling write_file repeatedly.',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        description: 'Files to write. Maximum 50 files per call.',
                        items: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: 'Target file path.'
                                },
                                content: {
                                    type: 'string',
                                    description: 'Text content to write.'
                                }
                            },
                            required: ['path', 'content']
                        }
                    }
                },
                required: ['files']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'patch_file',
            description: 'Applies a small bounded edit to an existing text file. Prefer this over rewriting a whole file when only a region changes.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the file to patch.'
                    },
                    edits: {
                        type: 'array',
                        description: 'Line-based edits using 1-based inclusive line numbers. Maximum 20 edits per call.',
                        items: {
                            type: 'object',
                            properties: {
                                startLine: { type: 'number', description: '1-based start line.' },
                                endLine: { type: 'number', description: '1-based inclusive end line.' },
                                replacement: { type: 'string', description: 'Replacement text for the selected line range.' }
                            },
                            required: ['startLine', 'endLine', 'replacement']
                        }
                    },
                    search: {
                        type: 'string',
                        description: 'Optional exact text to replace when edits are not provided.'
                    },
                    replace: {
                        type: 'string',
                        description: 'Replacement text for the exact search text.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_many_files',
            description: 'Reads multiple small text files in one bounded operation. Use when you need several files for context instead of repeated read_file calls.',
            parameters: {
                type: 'object',
                properties: {
                    paths: {
                        type: 'array',
                        description: 'File paths to read. Maximum 20 files per call.',
                        items: { type: 'string' }
                    }
                },
                required: ['paths']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: 'Searches file names under a root directory, respecting ignored folders like node_modules and .git. Use this instead of execute_command for filename discovery.',
            parameters: {
                type: 'object',
                properties: {
                    rootPath: {
                        type: 'string',
                        description: 'Root directory to search under.'
                    },
                    pattern: {
                        type: 'string',
                        description: 'Filename substring to search for.'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results to return. Default 50, max 200.'
                    }
                },
                required: ['rootPath', 'pattern']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_directory',
            description: 'Lists files and subdirectories in the specified folder and returns complete count/list evidence for that path.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the folder to be listed. Prefer direct Windows environment-variable paths like %USERPROFILE%/Desktop or %USERPROFILE%/Documents. Do not call get_system_info first for ordinary file listing; use it only if direct access fails. After a successful list_directory result, answer count/list questions directly from that result instead of probing the same path again.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_directory',
            description: 'Creates a new folder idempotently and reports whether it already existed. Requires a non-empty target path. Use once for the top-level project folder, then write files inside it. If you do not yet know the target path, resolve or infer it first instead of calling this tool with placeholders.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the folder to be created. Must be a non-empty path such as %USERPROFILE%/Desktop/my-app or an absolute path.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_file',
            description: 'Deletes the specified file.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the file to be deleted'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'file_exists',
            description: 'Checks if a file exists.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the file to be checked. Avoid hardcoded usernames in Windows paths. Do not use this for a directory that was already listed successfully with list_directory.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: 'Runs a one-shot PowerShell command. Use terminal_session_* tools instead for multi-step terminal work, dev servers, watchers, interactive prompts, or when shell state must persist. Use PowerShell syntax on Windows (e.g., $env:USERPROFILE, Test-Path, Get-ChildItem, New-Item), not CMD syntax. Prefer create_directory/write_file for scaffolding files and use this for short package manager or verification commands.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'PowerShell command to execute. Prefer PowerShell cmdlets/syntax; avoid CMD forms like "if not exist" and "%USERPROFILE%". If a prior command failed, inspect error/stderr/exitCode and change approach instead of repeating it.'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Directory where the command will be executed (optional)'
                    }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_start',
            description: 'Starts a persistent agent terminal session. Use this instead of execute_command for multi-step shell work, dev servers, test watchers, interactive prompts, or when cwd/env/history must persist across commands.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: {
                        type: 'string',
                        description: 'Optional stable session id. Omit to generate one.'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Initial working directory. Prefer the active project root.'
                    },
                    shell: {
                        type: 'string',
                        description: 'Optional shell id or executable path. Omit to use the system default.'
                    },
                    title: {
                        type: 'string',
                        description: 'Optional user-visible title for the terminal session.'
                    },
                    cols: {
                        type: 'number',
                        description: 'Optional terminal columns, clamped to a safe range.'
                    },
                    rows: {
                        type: 'number',
                        description: 'Optional terminal rows, clamped to a safe range.'
                    },
                    backendId: {
                        type: 'string',
                        description: 'Optional terminal backend id. Omit unless a specific backend is required.'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_write',
            description: 'Writes a command or process input to an existing persistent terminal session. Commands are safety-validated by default; use inputKind=input only for responding to an already-running process prompt.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: {
                        type: 'string',
                        description: 'Terminal session id returned by terminal_session_start.'
                    },
                    input: {
                        type: 'string',
                        description: 'Command or input to write. If a prior command failed, inspect terminal output and change approach instead of repeating it.'
                    },
                    inputKind: {
                        type: 'string',
                        enum: ['command', 'input'],
                        description: 'Use command for shell commands and input for interactive program input. Defaults to command.'
                    },
                    submit: {
                        type: 'boolean',
                        description: 'Whether to append Enter when the input does not already end with a newline. Defaults to true.'
                    }
                },
                required: ['sessionId', 'input']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_read',
            description: 'Reads the tail of a persistent terminal session buffer. Use this to inspect command output before deciding what to do next.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Terminal session id.' },
                    tailBytes: { type: 'number', description: 'Maximum output tail bytes to return. Defaults to 20000 and is capped.' }
                },
                required: ['sessionId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_wait',
            description: 'Waits for a terminal session to match a text pattern, become idle, or reach a timeout, then returns the latest output tail.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Terminal session id.' },
                    pattern: { type: 'string', description: 'Optional text to wait for in the terminal buffer.' },
                    idleMs: { type: 'number', description: 'How long output must stop changing before idle is reported. Defaults to 1000ms.' },
                    timeoutMs: { type: 'number', description: 'Maximum wait time. Defaults to 30000ms and is capped.' },
                    tailBytes: { type: 'number', description: 'Maximum output tail bytes to return.' }
                },
                required: ['sessionId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_signal',
            description: 'Sends a controlled terminal signal such as interrupt, eof, or enter to an existing terminal session.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Terminal session id.' },
                    signal: {
                        type: 'string',
                        enum: ['interrupt', 'eof', 'enter'],
                        description: 'Signal to send. Defaults to interrupt.'
                    }
                },
                required: ['sessionId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_stop',
            description: 'Stops a persistent terminal session and cleans up its process.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Terminal session id.' }
                },
                required: ['sessionId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_list',
            description: 'Lists active terminal session ids, including agent-managed sessions.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'terminal_session_snapshot',
            description: 'Returns a terminal session output tail plus analytics such as byte count, line count, command count, and update time.',
            parameters: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Terminal session id.' },
                    tailBytes: { type: 'number', description: 'Maximum output tail bytes to return. Defaults to 30000 and is capped.' }
                },
                required: ['sessionId']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_file_info',
            description: 'Returns file/folder information (size, date, etc.).',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to get information for. On Windows, avoid guessing the username segment in C:/Users/... paths.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_system_info',
            description: 'Returns system context (hostname, username, OS, platform, shell, homeDir). Use only when the task truly requires host metadata or when direct %USERPROFILE%-style paths failed.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'copy_file',
            description: 'Copies a file from one location to another.',
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'Source file path'
                    },
                    destination: {
                        type: 'string',
                        description: 'Destination file path'
                    }
                },
                required: ['source', 'destination']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'move_file',
            description: 'Moves a file from one location to another.',
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'Source file path'
                    },
                    destination: {
                        type: 'string',
                        description: 'Destination file path'
                    }
                },
                required: ['source', 'destination']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: 'ONLY use when the user EXPLICITLY asks for a visual/image/drawing. Example: "draw me a cat", "create a sky visual", "generate an image of a sunset". NEVER use for normal chat, questions, or coding tasks.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'Detailed prompt for the image (English or Turkish)'
                    },
                    count: {
                        type: 'number',
                        description: 'Total number of images to generate. If the user asked for multiple images (e.g., "5 images..."), be sure to specify this parameter. (default: 1, max: 5)'
                    }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_plan_step',
            description: 'Updates the status of a step in the current implementation plan. Use to report your progress to the user.',
            parameters: {
                type: 'object',
                properties: {
                    index: {
                        type: 'number',
                        description: 'Index of the step to update (0-based).'
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'running', 'completed', 'failed'],
                        description: 'The new status of the step.'
                    },
                    message: {
                        type: 'string',
                        description: 'Optional status message about the step (e.g., "File created and tested").'
                    }
                },
                required: ['index', 'status']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'propose_plan',
            description: 'MANDATORY: Submit an execution plan for user approval. You MUST call this tool after analyzing the task. Do NOT write the plan as text in the chat - always use this tool. The planning loop will stop once this tool is called.',
            parameters: {
                type: 'object',
                properties: {
                    steps: {
                        type: 'array',
                        items: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'object',
                                    properties: {
                                        text: { type: 'string' },
                                        type: {
                                            type: 'string',
                                            enum: ['task', 'fork', 'join'],
                                        },
                                        depends_on: {
                                            type: 'array',
                                            items: { type: 'string' },
                                        },
                                        priority: {
                                            type: 'string',
                                            enum: ['low', 'normal', 'high', 'critical'],
                                        },
                                        branch_id: { type: 'string' },
                                        lane: { type: 'number' },
                                    },
                                    required: ['text'],
                                },
                            ],
                        },
                        description: 'List of implementation steps. Supports plain strings or objects with type/dependency/priority metadata.'
                    }
                },
                required: ['steps']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'revise_plan',
            description: 'AGT-PLN-02: Dynamically modify the execution plan during execution. Use this when you realize the plan needs adjustment based on what you learned during execution.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'modify', 'insert'],
                        description: 'The type of revision: add (append step), remove (delete step), modify (change step text), insert (add step at position)'
                    },
                    index: {
                        type: 'number',
                        description: 'The step index to modify/remove/insert at (0-based). Required for remove, modify, insert.'
                    },
                    step_text: {
                        type: 'string',
                        description: 'The new step text. Required for add, modify, insert.'
                    },
                    reason: {
                        type: 'string',
                        description: 'Explanation of why this revision is needed.'
                    }
                },
                required: ['action', 'reason']
            }
        }
    }
];
