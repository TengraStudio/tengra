const sectionData = {
    "editor": "Editor",
    "council": "AI Council",
    "logs": "Logs",
    "terminal": "Terminal",
    "files": "Files",
    "toggleAgentPanel": "Toggle agent panel",
    "addMount": "Add directory",
    "addFirstMount": "Add the first mount",
    "addConnection": "Add connection",
    "noMounts": "No mounted folders",
    "removeMount": "Remove mount",
    "emptyFolder": "This folder is empty",
    "newFile": "New file",
    "newFolder": "New folder",
    "errors": {
        "emptyName": "Workspace name cannot be empty",
        "todoFileChanged": "File content changed. Please refresh.",
        "explorer": {
            "invalidMountSelected": "Invalid mount selected. Please refresh and try again.",
            "invalidFilePath": "Invalid file path. Please check the path and try again.",
            "mountNotFound": "Mount not found. It may have been removed.",
            "entryNotFound": "File or folder not found. It may have been deleted.",
            "invalidPath": "Invalid path. Path contains disallowed characters.",
            "permissionDenied": "Permission denied. You do not have access to this resource.",
            "validationError": "Validation error. Please check your input.",
            "unsupportedOperation": "This operation is not supported.",
            "unexpected": "An unexpected error occurred."
        },
        "fileOps": {
            "read": "Failed to read file",
            "write": "Failed to write file",
            "delete": "Failed to delete file",
            "rename": "Failed to rename file",
            "create": "Failed to create file",
            "move": "Failed to move file",
            "copy": "Failed to copy file",
            "list": "Failed to list directory"
        },
        "wizard": {
            "invalidInput": "Invalid input",
            "connectionFailed": "Connection failed",
            "connectFailed": "Failed to connect",
            "createWorkspaceFailed": "Failed to create workspace",
            "selectDirectoryFailed": "Failed to select directory"
        },
        "todoCanvas": {
            "exportTitle": "TODO canvas export",
            "dependenciesHeading": "Dependencies",
            "untitledTask": "Untitled task",
            "untitled": "Untitled",
            "defaultCategory": "General"
        },
        "logoGenerator": {
            "generatedResults": "Generated results",
            "pickLogo": "Pick a logo to apply it instantly.",
            "resultsCount": "{{count}} results",
            "singleResultCount": "1 result",
            "noLogosYet": "No logos generated yet",
            "configureAndGenerate": "Configure settings and click Generate."
        }
    },
    "notifications": {
        "sshConnectedAfterAttempts": "SSH connected after {{count}} attempts.",
        "sshConnectRetry": "Retrying SSH connection {{attempt}}/{{max}}...",
        "sshImagePreviewNotSupported": "SSH image preview not supported yet.",
        "fileCreated": "File created.",
        "folderCreated": "Folder created.",
        "entryRenamed": "Entry renamed.",
        "entryDeleted": "Entry deleted.",
        "entryMoved": "Entry moved.",
        "fileSaved": "File saved.",
        "saveFailed": "Save failed."
    },
    "listOps": {
        "updating": "Updating workspace...",
        "deleting": "Deleting workspace...",
        "archiving": "Archiving workspace...",
        "bulkDeleting": "Deleting {{count}} workspaces...",
        "bulkArchiving": "Archiving {{count}} workspaces...",
        "creating": "Creating workspace...",
        "updateFailed": "Failed to update workspace",
        "deleteFailed": "Failed to delete workspace",
        "archiveFailed": "Failed to archive workspace",
        "bulkDeleteFailed": "Failed to delete workspaces in bulk",
        "bulkArchiveFailed": "Failed to archive workspaces in bulk",
        "createFailed": "Failed to create workspace",
        "duplicateRemotePath": "A workspace already exists for this remote path.",
        "duplicateLocalDirectory": "A workspace already exists for this local directory.",
        "createMissingWorkspace": "Workspace creation did not return a saved workspace."
    },
    "rename": "Rename",
    "currentBranch": "Current branch",
    "typeCommand": "Type a command...",
    "writeSomething": "Write something...",
    "stopSpeaking": "Stop speaking",
    "speakCode": "Speak code",
    "improvePrompt": "Improve",
    "improvePromptWithAI": "Improve prompt with AI",
    "uploadOriginal": "Upload manual image",
    "applyLogo": "Apply this logo",
    "uploadImage": "Upload your own image",
    "totalSize": "Total size",
    "todoList": "Upcoming tasks",
    "dangerZone": "Danger zone",
    "uploadManualImage": "Upload manual image",
    "crafting": "Crafting...",
    "previewArea": "Preview area",
    "encoding": "Encoding",
    "language": "Language",
    "fileLabels": {
        "plainText": "Plain text",
        "encodingUtf8": "UTF-8",
        "encodingUtf8Bom": "UTF-8 BOM",
        "encodingUtf1632": "UTF-16/32",
        "encodingAscii": "ASCII"
    },
    "convertToCode": "Convert to code",
    "pinTab": "Pin tab",
    "unpinTab": "Unpin tab",
    "closeTab": "Close tab",
    "closeAllTabs": "Close all tabs",
    "closeTabsToRight": "Close tabs to the right",
    "closeOtherTabs": "Close other tabs",
    "copyPath": "Copy path",
    "copyRelativePath": "Copy relative path",
    "revealInExplorer": "Reveal in file explorer",
    "revealedInExplorer": "Opened in File Explorer.",
    "revealInExplorerFailed": "Failed to open File Explorer.",
    "pathCopied": "Path copied to clipboard.",
    "relativePathCopied": "Relative path copied to clipboard.",
    "pathCopyFailed": "Failed to copy path.",
    "placeholders": {
        "rootPath": "Root path",
        "name": "Name..."
    },
    "run": "Run workspace",
    "toggleSidebar": "Toggle sidebar",
    "aiAssistant": "AI assistant",
    "aiLabel": "AI",
    "online": "Online",
    "dev": "DEV",
    "loadingBranches": "Loading branches...",
    "noBranchesFound": "No branches found",
    "switchingBranch": "Switching branch...",
    "branchSwitched": "Switched to {{branch}}.",
    "branchSwitchFailed": "Failed to switch branch.",
    "issueBanner": {
        "workspaceFallback": "workspace",
        "startupChecks": "Startup checks for {{workspace}} ({{mode}} mode)",
        "openingMode": {
            "fast": "fast",
            "full": "full"
        },
        "securityPosture": "Security posture: {{risk}} risk",
        "maxConcurrentOps": "Max concurrent ops: {{count}}",
        "fixPrefix": "Fix:",
        "runbooks": "Runbooks",
        "running": "Running…",
        "runLabel": "Run {{label}}",
        "runbookTimeline": "Runbook timeline",
        "preparingRunbook": "Preparing {{label}}...",
        "rollbackHint": "Rollback hint: {{hint}}",
        "runbookStatus": {
            "success": "Success",
            "failed": "Failed"
        },
        "runbookLabels": {
            "setup": "Setup",
            "build": "Build",
            "test": "Test",
            "release": "Release prep"
        },
        "runbookRollbackHints": {
            "setup": "Delete generated dependencies and lock updates if setup introduced regressions.",
            "build": "Revert build config or generated artifacts to the last known good commit.",
            "test": "Roll back recent source or config changes that caused failing tests.",
            "release": "Stop release workflow, restore previous deployment config, and rerun validation checks."
        },
        "securityFindings": {
            "envFilesDetected": "Environment files detected. Make sure sensitive keys are excluded from version control.",
            "lockFileMissing": "Dependency lock file is missing; dependency supply chain risk is higher.",
            "evaluationUnavailable": "Security posture could not be fully evaluated."
        },
        "runbookTimelineMessages": {
            "queued": "Queued runbook",
            "failedBeforeExecution": "Failed before execution",
            "invalidPathOrCommand": "Invalid workspace path or runbook command.",
            "startedCommand": "Started command: {{command}}",
            "completedSuccessfully": "Completed successfully",
            "failedWithCode": "Failed with code {{code}}"
        },
        "preflightIssues": {
            "mount": {
                "missingPath": {
                    "message": "Workspace path is missing.",
                    "fixAction": "Update workspace settings and set a valid root path before opening."
                },
                "pathNotFound": {
                    "message": "Workspace path does not exist: {{path}}",
                    "fixAction": "Reconnect the drive or update the workspace path in workspace settings."
                },
                "multiRootLabelMissing": {
                    "message": "One or more mounts are missing labels.",
                    "fixAction": "Set a distinct name for each mount to keep multi-root explorer labels clear."
                }
            },
            "terminal": {
                "unavailable": {
                    "message": "No terminal backend is available.",
                    "fixAction": "Install or enable a terminal backend (PowerShell, Command Prompt, or another supported shell)."
                }
            },
            "analysis": {
                "indexingDisabled": {
                    "message": "Background indexing is disabled.",
                    "fixAction": "Enable indexing in workspace settings for workspace intelligence and navigation."
                }
            },
            "git": {
                "repositoryMissing": {
                    "message": "This folder is not a Git repository.",
                    "fixAction": "Run \"git init\" or clone the repository before opening workspace workflows."
                }
            },
            "policy": {
                "mainDirty": {
                    "message": "Policy warning: working tree is dirty on protected branch {{branch}}.",
                    "fixAction": "Commit to a feature branch, then merge after review."
                }
            },
            "toolchain": {
                "nodeMissing": {
                    "message": "Node.js is required for this workspace.",
                    "fixAction": "Install Node.js and ensure \"node --version\" works in your terminal."
                },
                "npmMissing": {
                    "message": "npm is required for this workspace.",
                    "fixAction": "Install npm (usually with Node.js) and ensure \"npm --version\" works."
                },
                "pythonMissing": {
                    "message": "Python is required for this workspace.",
                    "fixAction": "Install Python and ensure \"python --version\" works in your terminal."
                },
                "goMissing": {
                    "message": "Go is required for this workspace.",
                    "fixAction": "Install Go and ensure \"go version\" works in your terminal."
                },
                "nodeUnpinned": {
                    "message": "Node runtime is not pinned for this workspace.",
                    "fixAction": "Add .nvmrc or .tool-versions to lock the Node version per workspace."
                },
                "pythonUnpinned": {
                    "message": "Python runtime is not pinned for this workspace.",
                    "fixAction": "Add .python-version or .tool-versions to avoid environment drift."
                }
            }
        },
        "filters": {
            "severity": {
                "all": "All severities",
                "error": "Errors",
                "warning": "Warnings",
                "info": "Info"
            },
            "source": {
                "all": "All sources",
                "mount": "Mount",
                "git": "Git",
                "task": "Task",
                "analysis": "Analysis",
                "terminal": "Terminal",
                "policy": "Policy",
                "security": "Security",
                "toolchain": "Toolchain"
            }
        }
    },
    "listPresetTitle": "List preset",
    "listPresetRecent": "Recent first",
    "listPresetOldest": "Oldest first",
    "listPresetNameAz": "Name A-Z",
    "listPresetNameZa": "Name Z-A",
    "openTitle": "Open",
    "shortcuts": "Shortcuts",
    "quickSwitch": "Quick switch tabs",
    "toggleTerminal": "Toggle terminal",
    "todoLinePrefix": "Line",
    "shortcutHelpTitle": "Workspace shortcuts",
    "shortcutCombos": {
        "commandPalette": "Ctrl/Cmd + K",
        "quickSwitch": "Ctrl/Cmd + P",
        "closeTab": "Ctrl/Cmd + W",
        "toggleHelp": "Ctrl/Cmd + /",
        "toggleTerminal": "`"
    },
    "terminalStatusTerm": "TERM",
    "terminalStatusSsh": "SSH",
    "terminalStatusDocker": "Docker",
    "terminalStatusReady": "ready",
    "terminalStatusUnavailable": "unavailable",
    "todoUndoTitle": "Undo (Ctrl/Cmd+Z)",
    "todoRedoTitle": "Redo (Ctrl/Cmd+Y)",
};

export default sectionData;





