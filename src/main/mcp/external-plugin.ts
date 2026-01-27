import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { McpDispatchResult } from '@main/mcp/types';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { IMcpPlugin } from './plugin-base';

interface PendingRequest {
    resolve: (val: McpResponse) => void;
    reject: (err: Error) => void;
}

interface McpResponse {
    jsonrpc: string;
    id: string;
    result?: {
        content?: Array<{ type: string; text?: string }>;
    };
    error?: {
        code: number;
        message: string;
    };
}

/**
 * External MCP Plugin implementation.
 * Launches a standalone process and communicates via JSON-RPC over stdio.
 * This satisfies the "plugin" requirement by allowing tools to run in separate processes.
 */
export class ExternalMcpPlugin implements IMcpPlugin {
    public readonly source: 'user' | 'remote';
    private server: ChildProcess | null = null;
    private requestQueue = new Map<string, PendingRequest>();
    private buffer = '';

    constructor(
        public readonly name: string,
        public readonly description: string,
        private config: {
            command: string;
            args: string[];
            env?: Record<string, string>;
            isRemote?: boolean;
        }
    ) {
        this.source = config.isRemote ? 'remote' : 'user';
    }

    async initialize(): Promise<void> {
        if (this.server && !this.server.killed) { return; }

        appLogger.info('MCP', `Launching external plugin: ${this.name} (${this.config.command})`);

        const env = { ...process.env, ...this.config.env };
        const command = this.resolveCommand(this.config.command);

        this.server = spawn(command, this.config.args, {
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            env
        });

        this.server.stdout?.setEncoding('utf8');
        this.server.stderr?.setEncoding('utf8');

        this.server.stdout?.on('data', (chunk) => this.handleOutput(chunk));
        this.server.stderr?.on('data', (chunk) => appLogger.debug('MCP', `${this.name} ERR: ${chunk}`));

        this.server.on('error', (err) => {
            appLogger.error('MCP', `${this.name} Process error: ${getErrorMessage(err)}`);
            void this.dispose();
        });

        this.server.on('exit', (code) => {
            appLogger.info('MCP', `${this.name} Exited with code ${code}`);
            this.server = null;
        });
    }

    async dispose(): Promise<void> {
        if (this.server) {
            this.server.stdout?.removeAllListeners();
            this.server.stderr?.removeAllListeners();
            this.server.kill();
            this.server = null;
        }
        this.requestQueue.clear();
        this.buffer = '';
    }

    async getActions(): Promise<Array<{ name: string; description: string }>> {
        // In a real MCP implementation, we would call 'tools/list'
        // For now, we rely on the discovery phase to provide tool names
        // or we implement a full MCP client handshake here.
        return [];
    }

    async dispatch(actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        if (!this.server) {
            await this.initialize();
        }

        if (!this.server?.stdin) {
            return { success: false, error: 'Server process not available' };
        }

        const id = randomUUID();
        const request = {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: actionName, arguments: args },
            id
        };

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.requestQueue.delete(id);
                resolve({ success: false, error: `MCP Request Timeout (30s): ${this.name}.${actionName}` });
            }, 30000);

            this.requestQueue.set(id, {
                resolve: (msg: McpResponse) => {
                    clearTimeout(timeout);
                    if (msg.error) {
                        resolve({ success: false, error: msg.error.message });
                    } else {
                        const content = msg.result?.content?.[0]?.text ?? null;
                        resolve({ success: true, data: content, service: this.name, action: actionName });
                    }
                },
                reject: (err: Error) => {
                    clearTimeout(timeout);
                    resolve({ success: false, error: err.message });
                }
            });

            this.server?.stdin?.write(JSON.stringify(request) + '\n');
        });
    }

    isAlive(): boolean {
        return !!this.server && !this.server.killed;
    }

    private resolveCommand(command: string): string {
        const isWindows = process.platform === 'win32';
        if (isWindows && !command.endsWith('.exe') && !command.endsWith('.cmd') && !command.endsWith('.bat')) {
            if (['npm', 'npx', 'pnpm', 'yarn'].includes(command)) {
                return `${command}.cmd`;
            }
        }
        return command;
    }

    private handleOutput(chunk: string) {
        this.buffer += chunk;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            const msg = safeJsonParse<McpResponse>(line, {} as McpResponse);
            if (msg.jsonrpc === '2.0' && msg.id) {
                const id = String(msg.id);
                const handler = this.requestQueue.get(id);
                if (handler) {
                    this.requestQueue.delete(id);
                    handler.resolve(msg);
                }
            }
        }
    }
}
