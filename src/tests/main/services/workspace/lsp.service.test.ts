/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventEmitter } from 'events';
import * as fsModule from 'fs';
import { PassThrough } from 'stream';

import { LspService } from '@main/services/workspace/lsp.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NotificationHandler = (params: { uri: string; diagnostics: unknown[] }) => void;

const {
    mockSpawn,
    mockSendNotification,
    mockSendRequest,
    mockDispose,
} = vi.hoisted(() => ({
    mockSpawn: vi.fn(),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    mockSendRequest: vi.fn().mockResolvedValue({ capabilities: {} }),
    mockDispose: vi.fn(),
}));

let diagnosticsHandler: NotificationHandler | null = null;

vi.mock('child_process', () => ({
    spawn: mockSpawn,
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    promises: {
        readFile: vi.fn().mockResolvedValue('const value: string = 1;'),
    },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('vscode-jsonrpc/node', () => ({
    StreamMessageReader: class StreamMessageReader {
        constructor(_stream: unknown) {}
    },
    StreamMessageWriter: class StreamMessageWriter {
        constructor(_stream: unknown) {}
    },
    createMessageConnection: vi.fn(() => ({
        listen: vi.fn(),
        sendRequest: mockSendRequest,
        sendNotification: mockSendNotification,
        onNotification: vi.fn((_method: string, handler: NotificationHandler) => {
            diagnosticsHandler = handler;
        }),
        dispose: mockDispose,
    })),
}));

function createChildProcess(): EventEmitter & {
    stdout: PassThrough;
    stdin: PassThrough;
    kill: ReturnType<typeof vi.fn>;
} {
    const process = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stdin: PassThrough;
        kill: ReturnType<typeof vi.fn>;
    };
    process.stdout = new PassThrough();
    process.stdin = new PassThrough();
    process.kill = vi.fn();
    return process;
}

describe('LspService', () => {
    let lspService: LspService;

    beforeEach(() => {
        diagnosticsHandler = null;
        vi.clearAllMocks();
        mockSendRequest.mockResolvedValue({ capabilities: {} });
        mockSendNotification.mockResolvedValue(undefined);
        mockSpawn.mockReturnValue(createChildProcess());
        lspService = new LspService();
    });

    it('does not spawn duplicate servers for the same workspace', async () => {
        await Promise.all([
            lspService.startServer('workspace-1', 'C:/repo', 'typescript'),
            lspService.startServer('workspace-1', 'C:/repo', 'typescript'),
        ]);

        expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it.runIf(process.platform === 'win32')('spawns Windows cmd-based servers through the shell', async () => {
        vi.stubEnv('PATHEXT', '.COM;.EXE;.BAT;.CMD');
        await lspService.startServer('workspace-1', 'C:/repo', 'typescript');

        expect(mockSpawn).toHaveBeenCalledWith(
            expect.stringMatching(/cmd\.exe$/i),
            expect.arrayContaining(['/c', expect.stringMatching(/biome\.cmd|typescript-language-server\.cmd/i)]),
            expect.objectContaining({
                shell: false,
                windowsHide: true,
            })
        );
    });

    it('replaces cached diagnostics for the same document URI', async () => {
        await lspService.startServer('workspace-1', 'C:/repo', 'typescript');

        diagnosticsHandler?.({
            uri: 'file:///C:/repo/src/app.ts',
            diagnostics: [{ message: 'first' }],
        });
        diagnosticsHandler?.({
            uri: 'file:///C:/repo/src/app.ts',
            diagnostics: [{ message: 'second' }],
        });

        expect(lspService.getDiagnostics('workspace-1')).toEqual([
            {
                uri: 'file:///C:/repo/src/app.ts',
                diagnostics: [{ message: 'second' }],
            },
        ]);
    });

    it('clears diagnostics and document state when the server stops', async () => {
        await lspService.startServer('workspace-1', 'C:/repo', 'typescript');
        await lspService.openDocument('workspace-1', 'C:/repo/src/app.ts', 'typescript', 'const value = 1;');
        diagnosticsHandler?.({
            uri: 'file:///C:/repo/src/app.ts',
            diagnostics: [{ message: 'issue' }],
        });

        await lspService.stopServer('workspace-1');

        expect(lspService.getDiagnostics('workspace-1')).toEqual([]);
        expect(mockDispose).toHaveBeenCalled();
    });

    it('stops the instance when notification writes fail', async () => {
        await lspService.startServer('workspace-1', 'C:/repo', 'typescript');
        mockSendNotification.mockRejectedValueOnce(new Error('Cannot call write after a stream was destroyed'));

        await lspService.openDocument('workspace-1', 'C:/repo/src/app.ts', 'typescript', 'const value = 1;');

        expect(mockDispose).toHaveBeenCalled();
        expect(lspService.getDiagnostics('workspace-1')).toEqual([]);
    });

    it('matches special filenames to the correct language server support entries', () => {
        const support = lspService.getWorkspaceServerSupport('workspace-1', [
            'C:/repo/Dockerfile',
            'C:/repo/.eslintrc',
            'C:/repo/.bashrc',
        ]);

        expect(support).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ languageId: 'docker', serverId: 'docker-langserver', fileCount: 1 }),
                expect.objectContaining({ languageId: 'json', serverId: 'vscode-json-language-server', fileCount: 1 }),
                expect.objectContaining({ languageId: 'shell', serverId: 'bash-language-server', fileCount: 1 }),
            ])
        );
    });

    it('reports unavailable servers when no runnable binary exists', () => {
        vi.mocked(fsModule.existsSync).mockReturnValue(false);

        const support = lspService.getWorkspaceServerSupport('workspace-1', ['C:/repo/src/app.ts']);

        expect(support).toEqual([
            expect.objectContaining({
                languageId: 'typescript',
                serverId: 'biome',
                status: 'unavailable',
            }),
        ]);
    });
});

