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
            description: t('auto.readATextFileFromDisk'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('auto.absoluteOrRelativeFilePath') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__write',
            description: t('auto.writeOrOverwriteAFileCreatesParentFolder'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('auto.targetFilePath') },
                    content: { type: 'string', description: t('auto.fileContentToWrite') }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__list',
            description: t('auto.listFilesAndFoldersInADirectory'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('auto.directoryPathToList') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__extract_strings',
            description: t('auto.extractPrintableStringsFromAFileUsefulFo'),
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: t('auto.filePathToInspect') },
                    minLength: { type: 'number', description: t('auto.minimumStringLengthDefault4') }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__unzip',
            description: t('auto.extractAZipArchiveIntoADestinationFolder'),
            parameters: {
                type: 'object',
                properties: {
                    zipPath: { type: 'string', description: t('auto.pathToTheZipFile') },
                    destPath: { type: 'string', description: t('auto.destinationDirectoryForExtractedFiles') }
                },
                required: ['zipPath', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__filesystem__download',
            description: t('auto.downloadAFileFromAUrlAndSaveItLocally'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('auto.sourceUrl') },
                    destPath: { type: 'string', description: t('auto.localTargetFilePath') }
                },
                required: ['url', 'destPath']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__run_command',
            description: t('auto.runAShellCommandInAPersistentTerminalSes'),
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: t('auto.commandToExecute') },
                    cwd: { type: 'string', description: t('auto.optionalWorkingDirectory') },
                    session_id: { type: 'string', description: t('auto.optionalExistingSessionId') }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__list_sessions',
            description: t('auto.listActiveTerminalSessions1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__resize',
            description: t('auto.resizeAnExistingTerminalSession'),
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: t('auto.terminalSessionId') },
                    rows: { type: 'number', description: t('auto.terminalRows') },
                    cols: { type: 'number', description: t('auto.terminalColumns') }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__terminal__kill_session',
            description: t('auto.terminateATerminalSession1'),
            parameters: {
                type: 'object',
                properties: {
                    session_id: { type: 'string', description: t('auto.terminalSessionId') }
                },
                required: ['session_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__status',
            description: t('auto.showRepositoryFileStatus'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectoryOptionalIfPathIsGiven') },
                    path: { type: 'string', description: t('auto.repositoryDirectoryOptionalAliasOfCwd') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__diff',
            description: t('auto.showPatchDiffForTheRepositoryOrASingleFi'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectoryOptionalIfPathIsGiven') },
                    path: { type: 'string', description: t('auto.repositoryDirectoryOptionalAliasOfCwd') },
                    file: { type: 'string', description: t('auto.optionalFilePathFilter') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__blame',
            description: t('auto.showWhoLastChangedEachLineInAFile'),
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: t('auto.filePathRelativeToRepositoryRoot') },
                    cwd: { type: 'string', description: t('auto.repositoryDirectoryOptional') },
                    repo_path: { type: 'string', description: t('auto.repositoryDirectoryOptionalAliasOfCwd') }
                },
                required: ['file']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__log',
            description: t('auto.listRecentCommits'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') },
                    path: { type: 'string', description: t('auto.repositoryDirectoryOptionalAliasOfCwd') },
                    count: { type: 'number', description: t('auto.numberOfCommitsToReturnDefault10') }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__add',
            description: t('auto.stageFilesForCommit'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') },
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
            description: t('auto.createACommitWithAMessage'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') },
                    message: { type: 'string', description: t('auto.commitMessage') }
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
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') }
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
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') }
                },
                required: ['cwd']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__checkout',
            description: t('auto.switchToABranchOrCommitRef'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') },
                    branch: { type: 'string', description: t('auto.branchOrRefName') }
                },
                required: ['cwd', 'branch']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__git__branches',
            description: t('auto.listLocalBranches1'),
            parameters: {
                type: 'object',
                properties: {
                    cwd: { type: 'string', description: t('auto.repositoryDirectory') }
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
            description: t('auto.listEnvironmentVariables'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__process_list',
            description: t('auto.listRunningProcessesWithResourceUsage1'),
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'number', description: t('auto.maximumNumberOfProcessesDefault50') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__kill_process',
            description: t('auto.terminateAProcessByPid'),
            parameters: {
                type: 'object',
                properties: {
                    pid: { type: 'number', description: t('auto.processId') }
                },
                required: ['pid']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__system__disk_space',
            description: t('auto.getDiskUsageAndAvailableSpace'),
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
            description: t('auto.searchTheWebAndReturnRankedResults'),
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: t('auto.searchQuery') },
                    count: { type: 'number', description: t('auto.maximumResultCountDefault5') }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__read_page',
            description: t('auto.fetchAWebPageAndReturnItsContent'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('auto.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_view',
            description: t('auto.aliasForReadingAWebPage'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('auto.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__web__fetch_json',
            description: t('auto.fetchJsonResponseFromAUrl'),
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: t('auto.httphttpsUrl') }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__interfaces',
            description: t('auto.showNetworkInterfacesAndAddresses'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ports',
            description: t('auto.showActivelisteningPorts'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__ping',
            description: t('auto.pingAHost'),
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: t('auto.hostOrIpAddress') }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__traceroute',
            description: t('auto.traceRouteToAHost'),
            parameters: {
                type: 'object',
                properties: {
                    host: { type: 'string', description: t('auto.hostOrIpAddress') }
                },
                required: ['host']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__network__whois',
            description: t('auto.lookupDomainhostRegistrationMetadata'),
            parameters: {
                type: 'object',
                properties: {
                    domain: { type: 'string', description: t('auto.domainName') },
                    host: { type: 'string', description: t('auto.optionalAliasOfDomain') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__internet__weather',
            description: t('auto.getWeatherDataForALocation'),
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string', description: t('auto.locationCityRegionEtcOptional') }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listContainers',
            description: t('auto.listDockerContainers1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__stats',
            description: t('auto.showDockerContainerResourceUsage'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__workspace__listImages',
            description: t('auto.listDockerImages1'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__listModels',
            description: t('auto.listLocalLlmModelsFromOllama'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'mcp__llm__ps',
            description: t('auto.listCurrentlyRunningLocalLlmModelProcess'),
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: t('auto.generateOneOrMoreImagesFromAPromptUseOnl'),
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: t('auto.imagePromptText')
                    },
                    count: {
                        type: 'number',
                        description: t('auto.numberOfImagesToGenerateDefault1Max5')
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
            description: t('auto.updateTheStatusOfOnePlanStepDuringExecut'),
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
                        description: t('auto.newStepStatus')
                    },
                    message: {
                        type: 'string',
                        description: t('auto.optionalProgressNote')
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
            description: t('auto.submitAStructuredExecutionPlan'),
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
            description: t('auto.modifyAnExistingExecutionPlanWhileWorkIs'),
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['add', 'remove', 'modify', 'insert'],
                        description: t('auto.revisionType')
                    },
                    index: {
                        type: 'number',
                        description: '0-based step index. Required for remove/modify/insert.'
                    },
                    step_text: {
                        type: 'string',
                        description: t('auto.stepTextRequiredForAddmodifyinsert')
                    },
                    reason: {
                        type: 'string',
                        description: t('auto.whyTheRevisionIsNeeded')
                    }
                },
                required: ['action', 'reason']
            }
        }
    }
];

