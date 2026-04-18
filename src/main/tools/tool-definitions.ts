/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ToolDefinition } from '@shared/types/chat';

export const toolDefinitions: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__read',
            description: 'Read a text file from disk.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Absolute or relative file path.' }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__write',
            description: 'Write or overwrite a file. Creates parent folders when needed.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Target file path.' },
                    content: { type: 'string', description: 'File content to write.' }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__list',
            description: 'List files and folders in a directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Directory path to list.' }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__extract_strings',
            description: 'Extract printable strings from a file (useful for logs, binaries, dumps).',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'File path to inspect.' },
                    minLength: { type: 'number', description: 'Minimum string length. Default: 4.' }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__unzip',
            description: 'Extract a zip archive into a destination folder.',
            parameters: {
                type: 'object',
                properties: {
                    zipPath: { type: 'string', description: 'Path to the .zip file.' },
                    destPath: { type: 'string', description: 'Destination directory for extracted files.' }
                },
                required: ['zipPath', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__download',
            description: 'Download a file from a URL and save it locally.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'Source URL.' },
                    destPath: { type: 'string', description: 'Local target file path.' }
                },
                required: ['url', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__run_command',
            description: 'Run a shell command in a persistent terminal session (works across Windows/macOS/Linux).',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Command to execute.' },
                    cwd: { type: 'string', description: 'Optional working directory.' },
                    session_id: { type: 'string', description: 'Optional existing session id.' }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__list_sessions',
            description: 'List active terminal sessions.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__resize',
            description: 'Resize an existing terminal session.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: 'Terminal session id.' },
                    rows: { type: 'number', description: 'Terminal rows.' },
                    cols: { type: 'number', description: 'Terminal columns.' }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__kill_session',
            description: 'Terminate a terminal session.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: 'Terminal session id.' }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__status',
            description: 'Show repository file status.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory (optional if path is given).' },
                    path: { type: 'string', description: 'Repository directory (optional alias of cwd).' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__diff',
            description: 'Show patch diff for the repository or a single file.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory (optional if path is given).' },
                    path: { type: 'string', description: 'Repository directory (optional alias of cwd).' },
                    file: { type: 'string', description: 'Optional file path filter.' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__blame',
            description: 'Show who last changed each line in a file.',
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'File path relative to repository root.' },
                    cwd: { type: 'string', description: 'Repository directory (optional).' },
                    repo_path: { type: 'string', description: 'Repository directory (optional alias of cwd).' }
                },
                required: ['file']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__log',
            description: 'List recent commits.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' },
                    path: { type: 'string', description: 'Repository directory (optional alias of cwd).' },
                    count: { type: 'number', description: 'Number of commits to return. Default: 10.' }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__add',
            description: 'Stage files for commit.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' },
                    files: { type: 'string', description: 'File path to stage. Use "." to stage all.' }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__commit',
            description: 'Create a commit with a message.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' },
                    message: { type: 'string', description: 'Commit message.' }
                },
                required: ['cwd', 'message']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__push',
            description: 'Push local commits to remote.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__pull',
            description: 'Pull changes from remote.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__checkout',
            description: 'Switch to a branch or commit ref.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' },
                    branch: { type: 'string', description: 'Branch or ref name.' }
                },
                required: ['cwd', 'branch']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__branches',
            description: 'List local branches.',
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: 'Repository directory.' }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__get_info',
            description: 'Get OS, CPU, memory, and host information.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__env_vars',
            description: 'List environment variables.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__process_list',
            description: 'List running processes with resource usage.',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: 'Maximum number of processes. Default: 50.' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__kill_process',
            description: 'Terminate a process by PID.',
            parameters: {
                type: 'object',
                properties: {
                    pid: { type: 'number', description: 'Process id.' }
                },
                required: ['pid']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__disk_space',
            description: 'Get disk usage and available space.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__usage',
            description: 'Alias for system info/usage summary.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__search',
            description: 'Search the web and return ranked results.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query.' },
                    count: { type: 'number', description: 'Maximum result count. Default: 5.' }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__read_page',
            description: 'Fetch a web page and return its content.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'HTTP/HTTPS URL.' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_view',
            description: 'Alias for reading a web page.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'HTTP/HTTPS URL.' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_json',
            description: 'Fetch JSON response from a URL.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'HTTP/HTTPS URL.' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__interfaces',
            description: 'Show network interfaces and addresses.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ports',
            description: 'Show active/listening ports.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ping',
            description: 'Ping a host.',
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: 'Host or IP address.' }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__traceroute',
            description: 'Trace route to a host.',
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: 'Host or IP address.' }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__whois',
            description: 'Lookup domain/host registration metadata.',
            parameters: {
                type: 'object',
                properties: {
                    domain: { type: 'string', description: 'Domain name.' },
                    host: { type: 'string', description: 'Optional alias of domain.' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__internet__weather',
            description: 'Get weather data for a location.',
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string', description: 'Location (city, region, etc.). Optional.' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listContainers',
            description: 'List Docker containers.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__stats',
            description: 'Show Docker container resource usage.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listImages',
            description: 'List Docker images.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__listModels',
            description: 'List local LLM models from Ollama.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__ps',
            description: 'List currently running local LLM model processes.',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: 'Generate one or more images from a prompt. Use only when the user explicitly asks for image creation.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'Image prompt text.'
                    },
                    count: {
                        type: 'number',
                        description: 'Number of images to generate. Default: 1, max: 5.'
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
            description: 'Update the status of one plan step during execution.',
            parameters: {
                type: 'object',
                properties: {
                    index: {
                        type: 'number',
                        description: '0-based step index.'
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'running', 'completed', 'failed'],
                        description: 'New step status.'
                    },
                    message: {
                        type: 'string',
                        description: 'Optional progress note.'
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
            description: 'Submit a structured execution plan.',
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
            description: 'Modify an existing execution plan while work is in progress.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'modify', 'insert'],
                        description: 'Revision type.'
                    },
                    index: {
                        type: 'number',
                        description: '0-based step index. Required for remove/modify/insert.'
                    },
                    step_text: {
                        type: 'string',
                        description: 'Step text. Required for add/modify/insert.'
                    },
                    reason: {
                        type: 'string',
                        description: 'Why the revision is needed.'
                    }
                },
                required: ['action', 'reason']
            }
        }
    }
];
