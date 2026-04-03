import { ToolDefinition } from '@shared/types/chat';

export const toolDefinitions: ToolDefinition[] = [
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
            description: 'Writes a file to the specified path or updates an existing file.',
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
            description: 'Creates a new folder.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path of the folder to be created'
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
            description: 'Runs a PowerShell command. Use for system operations, file operations, network operations, etc.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'PowerShell command to be executed'
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
            name: 'capture_screenshot',
            description: 'Takes a screenshot.',
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
            name: 'capture_window',
            description: 'Takes a screenshot of the specified window (if supported).',
            parameters: {
                type: 'object',
                properties: {
                    window_name: {
                        type: 'string',
                        description: 'Window name / title'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_windows',
            description: 'Lists running windows (if supported).',
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
            name: 'fetch_webpage',
            description: 'Fetches the content of the specified URL and returns it as text.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'URL of the webpage to fetch'
                    }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'fetch_json',
            description: 'Fetches JSON content from a URL.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'URL for the GET request'
                    }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Searches the web and returns results.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query'
                    },
                    num_results: {
                        type: 'string',
                        description: 'Number of results to return (default: 5)'
                    }
                },
                required: ['query']
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
            name: 'remember',
            description: 'Store a fact or piece of information in the long-term memory for future retrieval.',
            parameters: {
                type: 'object',
                properties: {
                    fact: {
                        type: 'string',
                        description: 'The fact or information to remember.'
                    },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional tags to categorize the memory.'
                    }
                },
                required: ['fact']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'recall',
            description: 'Search the long-term memory for relevant information based on a query.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The query to search for in memory.'
                    }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'forget',
            description: 'Remove a specific fact from long-term memory by its ID.',
            parameters: {
                type: 'object',
                properties: {
                    fact_id: {
                        type: 'string',
                        description: 'The ID of the fact to forget/delete.'
                    }
                },
                required: ['fact_id']
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
