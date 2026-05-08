/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { t } from '@main/utils/i18n.util';
import { ToolDefinition } from '@shared/types/chat';

export const toolDefinitions: ToolDefinition[] = [
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__read',
            description: t('backend.readATextFileFromDisk'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('backend.absoluteOrRelativeFilePath') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__write',
            description: t('backend.writeOrOverwriteAFileCreatesParentFolder'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('backend.targetFilePath') },
                    content: { type: 'string', description: t('backend.fileContentToWrite') }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__list',
            description: t('backend.listFilesAndFoldersInADirectory'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('backend.directoryPathToList') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__extract_strings',
            description: t('backend.extractPrintableStringsFromAFileUsefulFo'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('backend.filePathToInspect') },
                    minLength: { type: 'number', description: t('backend.minimumStringLengthDefault4') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__unzip',
            description: t('backend.extractAZipArchiveIntoADestinationFolder'),
            parameters: {
                type: 'object',
                properties: {
                    zipPath: { type: 'string', description: t('backend.pathToTheZipFile') },
                    destPath: { type: 'string', description: t('backend.destinationDirectoryForExtractedFiles') }
                },
                required: ['zipPath', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__download',
            description: t('backend.downloadAFileFromAUrlAndSaveItLocally'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('backend.sourceUrl') },
                    destPath: { type: 'string', description: t('backend.localTargetFilePath') }
                },
                required: ['url', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__run_command',
            description: t('backend.runAShellCommandInAPersistentTerminalSes'),
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: t('backend.commandToExecute') },
                    cwd: { type: 'string', description: t('backend.optionalWorkingDirectory') },
                    session_id: { type: 'string', description: t('backend.optionalExistingSessionId') }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__list_sessions',
            description: t('backend.listActiveTerminalSessions1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__resize',
            description: t('backend.resizeAnExistingTerminalSession'),
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: t('backend.terminalSessionId') },
                    rows: { type: 'number', description: t('backend.terminalRows') },
                    cols: { type: 'number', description: t('backend.terminalColumns') }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__kill_session',
            description: t('backend.terminateATerminalSession1'),
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: t('backend.terminalSessionId') }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__status',
            description: t('backend.showRepositoryFileStatus'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectoryOptionalIfPathIsGiven') },
                    path: { type: 'string', description: t('backend.repositoryDirectoryOptionalAliasOfCwd') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__diff',
            description: t('backend.showPatchDiffForTheRepositoryOrASingleFi'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectoryOptionalIfPathIsGiven') },
                    path: { type: 'string', description: t('backend.repositoryDirectoryOptionalAliasOfCwd') },
                    file: { type: 'string', description: t('backend.optionalFilePathFilter') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__blame',
            description: t('backend.showWhoLastChangedEachLineInAFile'),
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: t('backend.filePathRelativeToRepositoryRoot') },
                    cwd: { type: 'string', description: t('backend.repositoryDirectoryOptional') },
                    repo_path: { type: 'string', description: t('backend.repositoryDirectoryOptionalAliasOfCwd') }
                },
                required: ['file']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__log',
            description: t('backend.listRecentCommits'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') },
                    path: { type: 'string', description: t('backend.repositoryDirectoryOptionalAliasOfCwd') },
                    count: { type: 'number', description: t('backend.numberOfCommitsToReturnDefault10') }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__add',
            description: t('backend.stageFilesForCommit'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') },
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
            description: t('backend.createACommitWithAMessage'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') },
                    message: { type: 'string', description: t('backend.commitMessage') }
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
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') }
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
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__checkout',
            description: t('backend.switchToABranchOrCommitRef'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') },
                    branch: { type: 'string', description: t('backend.branchOrRefName') }
                },
                required: ['cwd', 'branch']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__branches',
            description: t('backend.listLocalBranches1'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('backend.repositoryDirectory') }
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
            description: t('backend.listEnvironmentVariables'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__process_list',
            description: t('backend.listRunningProcessesWithResourceUsage1'),
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: t('backend.maximumNumberOfProcessesDefault50') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__kill_process',
            description: t('backend.terminateAProcessByPid'),
            parameters: {
                type: 'object',
                properties: {
                    pid: { type: 'number', description: t('backend.processId') }
                },
                required: ['pid']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__disk_space',
            description: t('backend.getDiskUsageAndAvailableSpace'),
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
            description: t('backend.searchTheWebAndReturnRankedResults'),
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: t('backend.searchQuery') },
                    count: { type: 'number', description: t('backend.maximumResultCountDefault5') }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__read_page',
            description: t('backend.fetchAWebPageAndReturnItsContent'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('backend.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_view',
            description: t('backend.aliasForReadingAWebPage'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('backend.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_json',
            description: t('backend.fetchJsonResponseFromAUrl'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('backend.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__interfaces',
            description: t('backend.showNetworkInterfacesAndAddresses'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ports',
            description: t('backend.showActivelisteningPorts'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ping',
            description: t('backend.pingAHost'),
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: t('backend.hostOrIpAddress') }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__traceroute',
            description: t('backend.traceRouteToAHost'),
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: t('backend.hostOrIpAddress') }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__whois',
            description: t('backend.lookupDomainhostRegistrationMetadata'),
            parameters: {
                type: 'object',
                properties: {
                    domain: { type: 'string', description: t('backend.domainName') },
                    host: { type: 'string', description: t('backend.optionalAliasOfDomain') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__internet__weather',
            description: t('backend.getWeatherDataForALocation'),
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string', description: t('backend.locationCityRegionEtcOptional') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listContainers',
            description: t('backend.listDockerContainers1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__stats',
            description: t('backend.showDockerContainerResourceUsage'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listImages',
            description: t('backend.listDockerImages1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__listModels',
            description: t('backend.listLocalLlmModelsFromOllama'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__ps',
            description: t('backend.listCurrentlyRunningLocalLlmModelProcess'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: t('backend.generateOneOrMoreImagesFromAPromptUseOnl'),
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: t('backend.imagePromptText')
                    },
                    count: {
                        type: 'number',
                        description: t('backend.numberOfImagesToGenerateDefault1Max5')
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
            description: t('backend.updateTheStatusOfOnePlanStepDuringExecut'),
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
                        description: t('backend.newStepStatus')
                    },
                    message: {
                        type: 'string',
                        description: t('backend.optionalProgressNote')
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
            description: t('backend.submitAStructuredExecutionPlan'),
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
            description: t('backend.modifyAnExistingExecutionPlanWhileWorkIs'),
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'modify', 'insert'],
                        description: t('backend.revisionType')
                    },
                    index: {
                        type: 'number',
                        description: '0-based step index. Required for remove/modify/insert.'
                    },
                    step_text: {
                        type: 'string',
                        description: t('backend.stepTextRequiredForAddmodifyinsert')
                    },
                    reason: {
                        type: 'string',
                        description: t('backend.whyTheRevisionIsNeeded')
                    }
                },
                required: ['action', 'reason']
            }
        }
    }
];

