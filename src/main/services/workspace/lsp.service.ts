/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChildProcess, spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { BaseService } from '@main/services/base.service';
import { getManagedRuntimeBinDir } from '@main/services/system/runtime-path.service';
import * as rpc from 'vscode-jsonrpc/node';
import * as protocol from 'vscode-languageserver-protocol';

export type WorkspaceServerLanguageId =
    | 'typescript'
    | 'javascript'
    | 'python'
    | 'go'
    | 'rust'
    | 'java'
    | 'cpp'
    | 'csharp'
    | 'php'
    | 'lua'
    | 'shell'
    | 'json'
    | 'html'
    | 'css'
    | 'yaml'
    | 'docker'
    | 'eslint';

interface LspCommandCandidate {
    command: string;
    localBinary?: boolean;
    args: string[];
}

interface ResolvedLspCommand {
    command: string;
    args: string[];
    shell: boolean;
}

interface LspServerDefinition {
    id: string;
    languageId: WorkspaceServerLanguageId;
    extensions: string[];
    fileNames?: string[];
    candidates: LspCommandCandidate[];
}

export interface LspServerInstance {
    process: ChildProcess;
    connection: rpc.MessageConnection;
    capabilities?: protocol.ServerCapabilities;
    workspaceId: string;
    rootPath: string;
    languageId: WorkspaceServerLanguageId;
    serverId: string;
    shuttingDown: boolean;
    exited: boolean;
    diagnosticProvider?: protocol.DiagnosticOptions;
    codeActionProvider?: boolean | protocol.CodeActionOptions;
}

interface OpenDocumentState {
    uri: string;
    languageId: WorkspaceServerLanguageId;
    version: number;
}

export interface LspDefinitionLocation {
    uri: string;
    line: number;
    column: number;
}

export interface LspServerSupportStatus {
    languageId: WorkspaceServerLanguageId;
    serverId: string;
    status: 'running' | 'available' | 'unavailable';
    bundled: boolean;
    fileCount: number;
}

const LSP_SERVER_DEFINITIONS: LspServerDefinition[] = [
    {
        id: 'biome',
        languageId: 'typescript',
        extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'biome.cmd' : 'biome',
                localBinary: true,
                args: ['lsp-proxy'],
            },
            {
                command: process.platform === 'win32' ? 'biome.exe' : 'biome',
                args: ['lsp-proxy'],
            },
        ],
    },
    {
        id: 'typescript-language-server',
        languageId: 'typescript',
        extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'typescript-language-server.cmd'
                    : 'typescript-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'ruff',
        languageId: 'python',
        extensions: ['.py', '.pyi', '.pyx'],
        fileNames: ['pyproject.toml', 'ruff.toml', '.ruff.toml'],
        candidates: [
            {
                command: 'ruff',
                args: ['server'],
            },
        ],
    },
    {
        id: 'pyright-langserver',
        languageId: 'python',
        extensions: ['.py', '.pyi', '.pyx'],
        fileNames: ['pyproject.toml'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'pyright-langserver.cmd' : 'pyright-langserver',
                localBinary: true,
                args: ['--stdio'],
            },
            {
                command: 'pyright-langserver',
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'gopls',
        languageId: 'go',
        extensions: ['.go'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'gopls.exe' : 'gopls',
                args: [],
            },
        ],
    },
    {
        id: 'rust-analyzer',
        languageId: 'rust',
        extensions: ['.rs'],
        candidates: [
            {
                command: 'rust-analyzer',
                args: [],
            },
            {
                command: 'rust-analyzer.exe',
                args: [],
            },
            {
                command: 'rustup',
                args: ['run', 'stable', 'rust-analyzer'],
            },
        ],
    },
    {
        id: 'jdtls',
        languageId: 'java',
        extensions: ['.java'],
        fileNames: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'jdtls.cmd' : 'jdtls',
                args: [],
            },
            {
                command: 'jdtls',
                args: [],
            },
        ],
    },
    {
        id: 'clangd',
        languageId: 'cpp',
        extensions: ['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx', '.m', '.mm'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'clangd.exe' : 'clangd',
                args: [],
            },
        ],
    },
    {
        id: 'omnisharp',
        languageId: 'csharp',
        extensions: ['.cs', '.csx', '.csproj'],
        fileNames: ['global.json'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'OmniSharp.exe' : 'omnisharp',
                args: ['-lsp'],
            },
        ],
    },
    {
        id: 'phpactor',
        languageId: 'php',
        extensions: ['.php', '.phtml', '.phpt'],
        fileNames: ['composer.json'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'phpactor.bat' : 'phpactor',
                args: ['language-server'],
            },
        ],
    },
    {
        id: 'lua-language-server',
        languageId: 'lua',
        extensions: ['.lua'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'lua-language-server.exe' : 'lua-language-server',
                args: [],
            },
        ],
    },
    {
        id: 'bash-language-server',
        languageId: 'shell',
        extensions: ['.sh', '.bash', '.zsh', '.ksh'],
        fileNames: [
            '.bashrc',
            '.bash_profile',
            '.profile',
            '.zshrc',
            '.zprofile',
            '.kshrc',
            '.envrc',
            'Jenkinsfile',
            'gradlew',
            'mvnw',
        ],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'bash-language-server.cmd'
                    : 'bash-language-server',
                localBinary: true,
                args: ['start'],
            },
            {
                command: 'bash-language-server',
                args: ['start'],
            },
        ],
    },
    {
        id: 'docker-langserver',
        languageId: 'docker',
        extensions: [],
        fileNames: ['Dockerfile', 'Containerfile'],
        candidates: [
            {
                command: process.platform === 'win32' ? 'docker-langserver.cmd' : 'docker-langserver',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'vscode-json-language-server',
        languageId: 'json',
        extensions: ['.json', '.jsonc'],
        fileNames: [
            '.eslintrc',
            '.prettierrc',
            '.stylelintrc',
            '.babelrc',
            '.swcrc',
            '.hintrc',
            'package.json',
            'package-lock.json',
            'composer.json',
            'tsconfig.json',
            'jsconfig.json',
        ],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'vscode-json-language-server.cmd'
                    : 'vscode-json-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'vscode-html-language-server',
        languageId: 'html',
        extensions: ['.html', '.htm', '.xhtml'],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'vscode-html-language-server.cmd'
                    : 'vscode-html-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'vscode-css-language-server',
        languageId: 'css',
        extensions: ['.css', '.scss', '.sass', '.less'],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'vscode-css-language-server.cmd'
                    : 'vscode-css-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'yaml-language-server',
        languageId: 'yaml',
        extensions: ['.yaml', '.yml'],
        fileNames: ['.yamllint'],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'yaml-language-server.cmd'
                    : 'yaml-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
            {
                command: 'yaml-language-server',
                args: ['--stdio'],
            },
        ],
    },
    {
        id: 'vscode-eslint-language-server',
        languageId: 'eslint',
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
        fileNames: ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json', 'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'],
        candidates: [
            {
                command: process.platform === 'win32'
                    ? 'vscode-eslint-language-server.cmd'
                    : 'vscode-eslint-language-server',
                localBinary: true,
                args: ['--stdio'],
            },
        ],
    },
];

export class LspService extends BaseService {
    private instances: Map<string, LspServerInstance> = new Map();
    private diagnostics: Map<string, protocol.PublishDiagnosticsParams[]> = new Map();
    private openDocuments: Map<string, Map<string, OpenDocumentState>> = new Map();
    private startPromises: Map<string, Promise<void>> = new Map();
    private workspaceServers: Map<string, Set<string>> = new Map();

    constructor(
        private mainWindowProvider?: () => import('electron').BrowserWindow | null,
        private runtimeBootstrapService?: import('@main/services/system/runtime-bootstrap.service').RuntimeBootstrapService
    ) {
        super('LspService');
    }

    async initialize(): Promise<void> {
        this.logInfo('LspService initializing...');
    }

    async startWorkspaceServers(
        workspaceId: string,
        rootPath: string,
        files: string[]
    ): Promise<void> {
        const definitions = this.detectWorkspaceServers(files);
        for (const definition of definitions) {
            await this.startServer(workspaceId, rootPath, definition.languageId);
        }
    }

    getWorkspaceServerSupport(workspaceId: string, files: string[]): LspServerSupportStatus[] {
        const definitions = this.detectWorkspaceServers(files);
        return definitions.map((definition) => {
            const instanceKey = this.toInstanceKey(workspaceId, definition.id);
            return {
                languageId: definition.languageId,
                serverId: definition.id,
                status: this.instances.has(instanceKey)
                    ? 'running'
                    : this.hasRunnableCandidate(definition) ? 'available' : 'unavailable',
                bundled: definition.candidates.some(
                    candidate => Boolean(candidate.localBinary) && this.resolveCommand(candidate) !== null
                ),
                fileCount: files.filter(file => this.matchesDefinition(definition, file)).length,
            };
        });
    }

    async startServer(
        workspaceId: string,
        rootPath: string,
        languageId: WorkspaceServerLanguageId
    ): Promise<void> {
        const definition = this.resolveDefinition(languageId);
        if (!definition) {
            this.logWarn(`No LSP definition configured for ${languageId}`);
            return;
        }

        const instanceKey = this.toInstanceKey(workspaceId, definition.id);
        const existingStart = this.startPromises.get(instanceKey);
        if (existingStart) {
            await existingStart;
            return;
        }
        if (this.instances.has(instanceKey)) {
            return;
        }

        const startPromise = this.startServerInternal(workspaceId, rootPath, definition);
        this.startPromises.set(instanceKey, startPromise);
        try {
            await startPromise;
        } finally {
            this.startPromises.delete(instanceKey);
        }
    }

    async openDocument(
        workspaceId: string,
        filePath: string,
        languageId: WorkspaceServerLanguageId,
        content: string
    ): Promise<void> {
        const definition = this.resolveDefinitionForFile(filePath, languageId);
        if (!definition) {
            return;
        }
        const instance = this.instances.get(this.toInstanceKey(workspaceId, definition.id));
        if (!instance) {
            return;
        }
        if (instance.shuttingDown || instance.exited || instance.process.killed) {
            return;
        }

        const documents = this.openDocuments.get(this.toInstanceKey(workspaceId, definition.id))
            ?? new Map<string, OpenDocumentState>();
        this.openDocuments.set(this.toInstanceKey(workspaceId, definition.id), documents);

        const normalizedFilePath = path.resolve(filePath);
        const existing = documents.get(normalizedFilePath);
        const uri = pathToFileURL(normalizedFilePath).toString();

        if (existing) {
            const nextVersion = existing.version + 1;
            const sentDidChange = await this.sendNotificationSafely(
                instance,
                protocol.DidChangeTextDocumentNotification.type.method,
                {
                    textDocument: { uri: existing.uri, version: nextVersion },
                    contentChanges: [{ text: content }],
                } satisfies protocol.DidChangeTextDocumentParams
            );
            if (!sentDidChange) {
                return;
            }
            documents.set(normalizedFilePath, {
                ...existing,
                version: nextVersion,
            });
            return;
        }

        const sentDidOpen = await this.sendNotificationSafely(
            instance,
            protocol.DidOpenTextDocumentNotification.type.method,
            {
                textDocument: {
                    uri,
                    languageId: definition.languageId,
                    version: 1,
                    text: content,
                },
            } satisfies protocol.DidOpenTextDocumentParams
        );
        if (!sentDidOpen) {
            return;
        }

        documents.set(normalizedFilePath, {
            uri,
            languageId: definition.languageId,
            version: 1,
        });
    }

    async closeDocument(workspaceId: string, filePath: string): Promise<void> {
        const definition = this.resolveDefinitionForFile(filePath);
        if (!definition) {
            return;
        }

        const instanceKey = this.toInstanceKey(workspaceId, definition.id);
        const instance = this.instances.get(instanceKey);
        const documents = this.openDocuments.get(instanceKey);
        if (!instance || !documents) {
            return;
        }

        const normalizedFilePath = path.resolve(filePath);
        const existing = documents.get(normalizedFilePath);
        if (!existing) {
            return;
        }

        const sentDidClose = await this.sendNotificationSafely(
            instance,
            protocol.DidCloseTextDocumentNotification.type.method,
            {
                textDocument: { uri: existing.uri },
            } satisfies protocol.DidCloseTextDocumentParams
        );
        if (!sentDidClose) {
            documents.delete(normalizedFilePath);
            return;
        }
        documents.delete(normalizedFilePath);
    }

    async primeWorkspaceDocuments(
        workspaceId: string,
        _rootPath: string,
        files: string[]
    ): Promise<void> {
        const candidateFiles = files.filter(file => this.resolveDefinitionForFile(file) !== null).slice(0, 200);
        for (const file of candidateFiles) {
            const definition = this.resolveDefinitionForFile(file);
            if (!definition) {
                continue;
            }
            const instanceKey = this.toInstanceKey(workspaceId, definition.id);
            if (!this.instances.has(instanceKey)) {
                continue;
            }
            try {
                const content = await fs.readFile(file, 'utf-8');
                await this.openDocument(workspaceId, file, definition.languageId, content);
            } catch (error) {
                this.logWarn(
                    `Failed to prime LSP document ${file}: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }

    getDiagnostics(workspaceId: string): protocol.PublishDiagnosticsParams[] {
        const normalizedWorkspaceId = workspaceId.toLowerCase();
        // Try exact match first, then fallback to case-insensitive search
        let serverIds = this.workspaceServers.get(workspaceId);
        if (!serverIds) {
            for (const [id, ids] of this.workspaceServers.entries()) {
                if (id.toLowerCase() === normalizedWorkspaceId) {
                    serverIds = ids;
                    break;
                }
            }
        }

        if (!serverIds) {
            return [];
        }

        const diagnostics: protocol.PublishDiagnosticsParams[] = [];
        for (const serverId of serverIds) {
            // Find the instance key that matches workspaceId and serverId
            let instanceKey = this.toInstanceKey(workspaceId, serverId);
            if (!this.diagnostics.has(instanceKey)) {
                // Try case-insensitive instance key match
                for (const [key, _] of this.diagnostics.entries()) {
                    if (key.toLowerCase() === instanceKey.toLowerCase()) {
                        instanceKey = key;
                        break;
                    }
                }
            }
            diagnostics.push(...(this.diagnostics.get(instanceKey) ?? []));
        }
        return diagnostics;
    }
    
    async pullDiagnostics(
        workspaceId: string,
        filePath: string,
        languageId: WorkspaceServerLanguageId
    ): Promise<protocol.Diagnostic[] | null> {
        const definition = this.resolveDefinitionForFile(filePath, languageId);
        if (!definition) {return null;}

        const instance = this.instances.get(this.toInstanceKey(workspaceId, definition.id));
        if (!instance?.diagnosticProvider) {return null;}

        const normalizedFilePath = path.resolve(filePath);
        const documents = this.openDocuments.get(this.toInstanceKey(workspaceId, definition.id));
        const openDocument = documents?.get(normalizedFilePath);
        const uri = openDocument?.uri ?? pathToFileURL(normalizedFilePath).toString();

        try {
            const result = await instance.connection.sendRequest(protocol.DocumentDiagnosticRequest.type.method, {
                textDocument: { uri }
            }) as protocol.DocumentDiagnosticReport;

            if (result && typeof result === 'object' && 'items' in (result as unknown as protocol.FullDocumentDiagnosticReport)) {
                const diagnostics = (result as unknown as protocol.FullDocumentDiagnosticReport).items as protocol.Diagnostic[];
                // Update local cache
                this.handleDiagnostics(this.toInstanceKey(workspaceId, definition.id), {
                    uri,
                    diagnostics
                });
                return diagnostics;
            }
            return null;
        } catch (error) {
            this.logWarn(`Failed to pull diagnostics for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    async getCodeActions(
        workspaceId: string,
        filePath: string,
        languageId: WorkspaceServerLanguageId,
        range: protocol.Range,
        diagnostics: protocol.Diagnostic[]
    ): Promise<(protocol.Command | protocol.CodeAction)[] | null> {
        const definition = this.resolveDefinitionForFile(filePath, languageId);
        if (!definition) {return null;}

        const instance = this.instances.get(this.toInstanceKey(workspaceId, definition.id));
        if (!instance?.codeActionProvider) {return null;}

        const normalizedFilePath = path.resolve(filePath);
        const documents = this.openDocuments.get(this.toInstanceKey(workspaceId, definition.id));
        const openDocument = documents?.get(normalizedFilePath);
        const uri = openDocument?.uri ?? pathToFileURL(normalizedFilePath).toString();

        try {
            const result = await instance.connection.sendRequest(protocol.CodeActionRequest.type.method, {
                textDocument: { uri },
                range,
                context: { diagnostics }
            });
            return result as (protocol.Command | protocol.CodeAction)[] | null;
        } catch (error) {
            this.logWarn(`Failed to get code actions for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    async getDefinition(
        workspaceId: string,
        filePath: string,
        languageId: WorkspaceServerLanguageId,
        line: number,
        column: number
    ): Promise<LspDefinitionLocation[]> {
        const definition = this.resolveDefinitionForFile(filePath, languageId);
        if (!definition) {
            return [];
        }

        const instance = this.instances.get(this.toInstanceKey(workspaceId, definition.id));
        if (!instance || instance.shuttingDown || instance.exited || instance.process.killed) {
            return [];
        }

        const normalizedFilePath = path.resolve(filePath);
        const documents = this.openDocuments.get(this.toInstanceKey(workspaceId, definition.id));
        const openDocument = documents?.get(normalizedFilePath);
        const uri = openDocument?.uri ?? pathToFileURL(normalizedFilePath).toString();

        const result = await this.sendRequestSafely<
            protocol.DefinitionParams,
            protocol.Definition | protocol.DefinitionLink[] | null
        >(
            instance,
            protocol.DefinitionRequest.type.method,
            {
                textDocument: { uri },
                position: {
                    line: Math.max(0, Math.floor(line) - 1),
                    character: Math.max(0, Math.floor(column) - 1),
                },
            } satisfies protocol.DefinitionParams
        );

        return this.normalizeDefinitionResult(result);
    }

    async stopServer(workspaceId: string): Promise<void> {
        const serverIds = Array.from(this.workspaceServers.get(workspaceId) ?? []);
        for (const serverId of serverIds) {
            await this.stopServerInstance(workspaceId, serverId);
        }
        this.workspaceServers.delete(workspaceId);
    }

    async stopServersWithinRoot(rootPath: string): Promise<void> {
        const normalizedRootPath = path.resolve(rootPath);
        const workspaceIds = Array.from(this.workspaceServers.keys());
        for (const workspaceId of workspaceIds) {
            const normalizedWorkspaceId = path.resolve(workspaceId);
            if (
                normalizedWorkspaceId === normalizedRootPath ||
                normalizedWorkspaceId.startsWith(`${normalizedRootPath}${path.sep}`)
            ) {
                await this.stopServer(workspaceId);
            }
        }
    }

    async dispose(): Promise<void> {
        for (const workspaceId of Array.from(this.workspaceServers.keys())) {
            await this.stopServer(workspaceId);
        }
    }

    private async startServerInternal(
        workspaceId: string,
        rootPath: string,
        definition: LspServerDefinition
    ): Promise<void> {
        this.logInfo(`Starting LSP server ${definition.id} for ${definition.languageId} in ${rootPath}`);

        const resolvedCommand = this.resolveRunnableCommand(definition);
        if (!resolvedCommand) {
            this.logWarn(`No runnable LSP binary found for ${definition.id}`);
            return;
        }
        const serverProcess = this.spawnServerProcess(rootPath, resolvedCommand);

        const stdout = serverProcess.stdout;
        const stdin = serverProcess.stdin;
        const stderr = serverProcess.stderr;
        if (!stdout || !stdin) {
            this.logError(
                'LSP server spawned without stdout or stdin',
                new Error('Process IO isolation failure')
            );
            serverProcess.kill();
            return;
        }

        const instanceKey = this.toInstanceKey(workspaceId, definition.id);
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(stdout),
            new rpc.StreamMessageWriter(stdin)
        );
        connection.listen();

        serverProcess.on('error', (error) => {
            this.logWarn(`Failed to spawn ${definition.id} with ${resolvedCommand.command}: ${error.message}`);
            this.logError(`LSP server process for ${definition.id} error`, error);
            void this.stopServerInstance(workspaceId, definition.id);
        });

        serverProcess.on('exit', () => {
            const instance = this.instances.get(instanceKey);
            if (instance) {
                instance.exited = true;
            }
            this.instances.delete(instanceKey);
            this.diagnostics.delete(instanceKey);
            this.openDocuments.delete(instanceKey);
        });

        stderr?.on('data', (chunk: Buffer | string) => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
            const trimmed = text.trim();
            if (trimmed) {
                this.logWarn(`[${definition.id}] ${trimmed}`);
            }
        });

        connection.onNotification(
            protocol.PublishDiagnosticsNotification.type.method,
            (params: protocol.PublishDiagnosticsParams) => {
                this.handleDiagnostics(instanceKey, params);
            }
        );

        const rootUri = pathToFileURL(rootPath).toString();
        const initParams: protocol.InitializeParams = {
            processId: process.pid,
            rootUri,
            capabilities: {
                textDocument: {
                    publishDiagnostics: {
                        relatedInformation: true,
                        tagSupport: { valueSet: [1, 2] },
                        versionSupport: true,
                    },
                    synchronization: {
                        didSave: true,
                        dynamicRegistration: false,
                        willSave: false,
                        willSaveWaitUntil: false,
                    },
                    diagnostic: {
                        dynamicRegistration: false,
                    },
                    codeAction: {
                        dynamicRegistration: false,
                        codeActionLiteralSupport: {
                            codeActionKind: {
                                valueSet: [
                                    protocol.CodeActionKind.Empty,
                                    protocol.CodeActionKind.QuickFix,
                                    protocol.CodeActionKind.Refactor,
                                    protocol.CodeActionKind.RefactorExtract,
                                    protocol.CodeActionKind.RefactorInline,
                                    protocol.CodeActionKind.RefactorRewrite,
                                    protocol.CodeActionKind.Source,
                                    protocol.CodeActionKind.SourceOrganizeImports,
                                ],
                            },
                        },
                    },
                },
                workspace: {
                    configuration: false,
                    workspaceFolders: true,
                },
            },
            workspaceFolders: [
                {
                    uri: rootUri,
                    name: path.basename(rootPath),
                },
            ],
        };

        try {
            const initResult = await connection.sendRequest(protocol.InitializeRequest.type.method, initParams) as protocol.InitializeResult;
            
            const instance: LspServerInstance = {
                process: serverProcess,
                connection,
                capabilities: initResult.capabilities,
                diagnosticProvider: initResult.capabilities.diagnosticProvider as protocol.DiagnosticOptions,
                codeActionProvider: initResult.capabilities.codeActionProvider,
                workspaceId,
                rootPath,
                languageId: definition.languageId,
                serverId: definition.id,
                shuttingDown: false,
                exited: false,
            };
            this.instances.set(instanceKey, instance);

            this.openDocuments.set(instanceKey, new Map<string, OpenDocumentState>());

            const workspaceServerIds = this.workspaceServers.get(workspaceId) ?? new Set<string>();
            workspaceServerIds.add(definition.id);
            this.workspaceServers.set(workspaceId, workspaceServerIds);

            this.logInfo(`LSP server ${definition.id} started for ${definition.languageId}.`);
        } catch (error) {
            this.logWarn(
                `Failed to initialize LSP server ${definition.id}: ${error instanceof Error ? error.message : String(error)}`
            );
            connection.dispose();
            if (!serverProcess.killed) {
                serverProcess.kill();
            }
        }
    }

    private async stopServerInstance(workspaceId: string, serverId: string): Promise<void> {
        const instanceKey = this.toInstanceKey(workspaceId, serverId);
        const instance = this.instances.get(instanceKey);
        if (!instance) {
            return;
        }
        instance.shuttingDown = true;

        const documents = this.openDocuments.get(instanceKey);
        if (documents) {
            for (const filePath of Array.from(documents.keys())) {
                await this.closeDocument(workspaceId, filePath);
            }
        }

        instance.connection.dispose();
        instance.process.kill();
        this.instances.delete(instanceKey);
        this.diagnostics.delete(instanceKey);
        this.openDocuments.delete(instanceKey);

        const workspaceServerIds = this.workspaceServers.get(workspaceId);
        workspaceServerIds?.delete(serverId);
        if (workspaceServerIds?.size === 0) {
            this.workspaceServers.delete(workspaceId);
        }
    }

    private spawnServerProcess(rootPath: string, command: ResolvedLspCommand): ChildProcess {
        let spawnCommand = command.command;
        let spawnArgs = command.args;
        let useShell = command.shell;

        if (process.platform === 'win32' && useShell) {
            spawnCommand = process.env.ComSpec || 'cmd.exe';
            spawnArgs = ['/d', '/s', '/c', command.command, ...command.args];
            useShell = false;
        }

        return spawn(spawnCommand, spawnArgs, {
            cwd: rootPath,
            shell: useShell,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
    }

    private resolveCommand(candidate: LspCommandCandidate): ResolvedLspCommand | null {
        if (candidate.localBinary) {
            const localPath = path.resolve(process.cwd(), 'node_modules', '.bin', candidate.command);
            if (existsSync(localPath)) {
                return {
                    command: localPath,
                    args: candidate.args,
                    shell: this.requiresShell(localPath),
                };
            }
            return null;
        }

        // Check managed runtime bin directory first
        const managedBinDir = getManagedRuntimeBinDir();
        const managedPath = path.join(managedBinDir, process.platform === 'win32' ? `${candidate.command}.exe` : candidate.command);
        if (existsSync(managedPath)) {
            return {
                command: managedPath,
                args: candidate.args,
                shell: false,
            };
        }

        return this.resolvePathCommand(candidate.command);
    }

    private hasRunnableCandidate(definition: LspServerDefinition): boolean {
        return definition.candidates.some(candidate => this.resolveCommand(candidate) !== null);
    }

    private resolveRunnableCommand(definition: LspServerDefinition): ResolvedLspCommand | null {
        for (const candidate of definition.candidates) {
            const resolved = this.resolveCommand(candidate);
            if (resolved) {
                return resolved;
            }
        }
        return null;
    }

    private resolvePathCommand(command: string): ResolvedLspCommand | null {
        if (path.isAbsolute(command) && existsSync(command)) {
            return {
                command,
                args: [],
                shell: this.requiresShell(command),
            };
        }

        const pathValue = process.env['PATH'];
        if (!pathValue) {
            return null;
        }

        const extensions = process.platform === 'win32'
            ? (process.env['PATHEXT']?.split(';').filter(Boolean) ?? ['.exe', '.cmd', '.bat'])
            : [''];
        for (const segment of pathValue.split(path.delimiter)) {
            if (!segment) {
                continue;
            }

            const baseCandidate = path.join(segment, command);
            for (const extension of extensions) {
                const candidatePath = baseCandidate.toLowerCase().endsWith(extension.toLowerCase())
                    ? baseCandidate
                    : `${baseCandidate}${extension}`;
                if (existsSync(candidatePath)) {
                    return {
                        command: candidatePath,
                        args: [],
                        shell: this.requiresShell(candidatePath),
                    };
                }
            }

            if (existsSync(baseCandidate)) {
                return {
                    command,
                    args: [],
                    shell: this.requiresShell(baseCandidate),
                };
            }
        }

        return null;
    }

    private requiresShell(commandPath: string): boolean {
        const normalizedCommandPath = commandPath.toLowerCase();
        if (normalizedCommandPath.endsWith('.cmd') || normalizedCommandPath.endsWith('.bat')) {
            return true;
        }
        // rust-analyzer on Windows often fails when called directly if it's a rustup shim.
        // Using a shell helps resolve the shim correctly.
        if (process.platform === 'win32' && normalizedCommandPath.includes('rust-analyzer')) {
            return true;
        }
        return false;
    }

    private async sendNotificationSafely(
        instance: LspServerInstance,
        method: string,
        params: protocol.DidOpenTextDocumentParams | protocol.DidChangeTextDocumentParams | protocol.DidCloseTextDocumentParams
    ): Promise<boolean> {
        if (instance.shuttingDown || instance.exited || instance.process.killed) {
            return false;
        }

        try {
            await instance.connection.sendNotification(method, params);
            return true;
        } catch (error) {
            instance.shuttingDown = true;
            this.logWarn(
                `LSP notification ${method} failed for ${instance.serverId}: ${error instanceof Error ? error.message : String(error)}`
            );
            await this.stopServerInstance(instance.workspaceId, instance.serverId);
            return false;
        }
    }

    private async sendRequestSafely<TParams, TResult>(
        instance: LspServerInstance,
        method: string,
        params: TParams
    ): Promise<TResult | null> {
        if (instance.shuttingDown || instance.exited || instance.process.killed) {
            return null;
        }

        try {
            return await instance.connection.sendRequest(method, params) as TResult;
        } catch (error) {
            instance.shuttingDown = true;
            this.logWarn(
                `LSP request ${method} failed for ${instance.serverId}: ${error instanceof Error ? error.message : String(error)}`
            );
            await this.stopServerInstance(instance.workspaceId, instance.serverId);
            return null;
        }
    }

    private normalizeDefinitionResult(
        result: protocol.Definition | protocol.DefinitionLink[] | null | undefined
    ): LspDefinitionLocation[] {
        if (!result) {
            return [];
        }

        const locations = Array.isArray(result) ? result : [result];
        const normalized: LspDefinitionLocation[] = [];
        for (const item of locations) {
            if ('targetUri' in item) {
                normalized.push({
                    uri: item.targetUri,
                    line: item.targetSelectionRange.start.line + 1,
                    column: item.targetSelectionRange.start.character + 1,
                });
                continue;
            }

            normalized.push({
                uri: item.uri,
                line: item.range.start.line + 1,
                column: item.range.start.character + 1,
            });
        }

        return normalized;
    }

    private handleDiagnostics(instanceKey: string, params: protocol.PublishDiagnosticsParams): void {
        let workspaceDiagnostics = this.diagnostics.get(instanceKey) ?? [];
        workspaceDiagnostics = workspaceDiagnostics.filter(item => item.uri !== params.uri);
        workspaceDiagnostics.push(params);
        this.diagnostics.set(instanceKey, workspaceDiagnostics);
        this.logDebug(`Received diagnostics for ${params.uri}: ${params.diagnostics.length} issues`);

        // Emit real-time event to renderer
        const mainWindow = this.mainWindowProvider?.();
        if (mainWindow && !mainWindow.isDestroyed()) {
            const lastColonIndex = instanceKey.lastIndexOf(':');
            const workspaceId = lastColonIndex !== -1 ? instanceKey.substring(0, lastColonIndex) : instanceKey;
            mainWindow.webContents.send('lsp:diagnostics-updated', {
                workspaceId,
                uri: params.uri,
                diagnostics: params.diagnostics,
                instanceKey
            });
        }
    }

    private triggeredInstalls = new Set<string>();

    private triggerManagedInstall(componentId: string) {
        if (!this.runtimeBootstrapService || this.triggeredInstalls.has(componentId)) {return;}
        this.triggeredInstalls.add(componentId);
        this.logInfo(`Triggering background installation for missing managed dependency: ${componentId}`);
        this.runtimeBootstrapService.runComponentAction(componentId).catch(err => {
            this.logError(`Failed to trigger installation for ${componentId}`, err);
            this.triggeredInstalls.delete(componentId);
        });
    }

    private detectWorkspaceServers(files: string[]): LspServerDefinition[] {
        const detected = new Set<string>();
        for (const file of files) {
            const definition = this.resolveDefinitionForFile(file);
            if (definition) {
                detected.add(definition.id);
            }
        }
        return LSP_SERVER_DEFINITIONS.filter(definition => detected.has(definition.id));
    }

    private resolveDefinition(languageId: WorkspaceServerLanguageId): LspServerDefinition | null {
        const matches = LSP_SERVER_DEFINITIONS.filter(definition => definition.languageId === languageId);
        if (matches.length === 0) {return null;}
        
        const preferred = matches[0];
        if ((preferred.id === 'biome' || preferred.id === 'ruff') && !this.hasRunnableCandidate(preferred)) {
            this.triggerManagedInstall(preferred.id);
        }

        const runnable = matches.find(def => this.hasRunnableCandidate(def));
        return runnable ?? preferred;
    }

    getLanguageIdForFile(filePath: string): WorkspaceServerLanguageId | null {
        return this.resolveDefinitionForFile(filePath)?.languageId ?? null;
    }

    private resolveDefinitionForFile(
        filePath: string,
        fallbackLanguageId?: WorkspaceServerLanguageId
    ): LspServerDefinition | null {
        if (fallbackLanguageId) {
            return this.resolveDefinition(fallbackLanguageId);
        }
        const matches = LSP_SERVER_DEFINITIONS.filter(definition => this.matchesDefinition(definition, filePath));
        if (matches.length === 0) {return null;}
        
        const preferred = matches[0];
        if ((preferred.id === 'biome' || preferred.id === 'ruff') && !this.hasRunnableCandidate(preferred)) {
            this.triggerManagedInstall(preferred.id);
        }

        const runnable = matches.find(def => this.hasRunnableCandidate(def));
        return runnable ?? preferred;
    }

    private matchesDefinition(definition: LspServerDefinition, filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();
        if (definition.extensions.includes(extension)) {
            return true;
        }

        const fileName = path.basename(filePath);
        const normalizedFileName = fileName.toLowerCase();
        return (definition.fileNames ?? []).some((candidate) => candidate.toLowerCase() === normalizedFileName);
    }

    private toInstanceKey(workspaceId: string, serverId: string): string {
        return `${workspaceId}:${serverId}`;
    }
}

