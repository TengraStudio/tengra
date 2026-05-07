/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { Worker } from 'worker_threads';

/** Configuration for the plugin sandbox environment. */
export interface SandboxConfig {
    maxMemoryMB: number;
    maxCpuPercent: number;
    allowedPaths: string[];
    deniedPaths: string[];
    networkAccess: boolean;
    maxExecutionTimeMs: number;
}

/** Result returned from sandboxed execution. */
export interface SandboxResult<T> {
    success: boolean;
    result?: T;
    error?: string;
    executionTimeMs: number;
    memoryUsedMB: number;
}

/** Message sent to the sandbox worker thread. */
interface WorkerRequest {
    code: string;
    allowedPaths: string[];
    deniedPaths: string[];
    networkAccess: boolean;
}

/** Message received from the sandbox worker thread. */
interface WorkerResponse {
    success: boolean;
    result?: RuntimeValue;
    error?: string;
    memoryUsedMB: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
    maxMemoryMB: 128,
    maxCpuPercent: 50,
    allowedPaths: [],
    deniedPaths: [],
    networkAccess: false,
    maxExecutionTimeMs: 30_000,
};

/**
 * Inline worker script that executes sandboxed code in an isolated thread.
 * Path and network restrictions are enforced by overriding globals.
 */
function buildWorkerScript(): string {
    return `
const { parentPort, workerData } = require('worker_threads');
const _origReadFile = require('fs').readFileSync;
const _path = require('path');

function isPathAllowed(target, allowed, denied) {
    const resolved = _path.resolve(target);
    for (const d of denied) {
        if (resolved.startsWith(_path.resolve(d))) return false;
    }
    if (allowed.length === 0) return true;
    for (const a of allowed) {
        if (resolved.startsWith(_path.resolve(a))) return true;
    }
    return false;
}

const { code, allowedPaths, deniedPaths, networkAccess } = workerData;

// Override fs to restrict paths
const fs = require('fs');
const origFns = ['readFileSync','writeFileSync','readdirSync','existsSync',
                 'statSync','mkdirSync','unlinkSync','renameSync'];
for (const fn of origFns) {
    const orig = fs[fn];
    if (typeof orig === 'function') {
        fs[fn] = function(p, ...args) {
            if (typeof p === 'string' && !isPathAllowed(p, allowedPaths, deniedPaths)) {
                throw new Error('Access denied: ' + p);
            }
            return orig.call(fs, p, ...args);
        };
    }
}

// Block network if not allowed
if (!networkAccess) {
    try { require('http').request = () => { throw new Error('Network access denied'); }; } catch(_) {}
    try { require('https').request = () => { throw new Error('Network access denied'); }; } catch(_) {}
    try { require('net').connect = () => { throw new Error('Network access denied'); }; } catch(_) {}
}

(async () => {
    const mem = process.memoryUsage();
    try {
        const fn = new Function('require', '__filename', '__dirname', code);
        const result = fn(require, '', '');
        const finalResult = result instanceof Promise ? await result : result;
        const memAfter = process.memoryUsage();
        const memUsed = (memAfter.heapUsed - mem.heapUsed) / (1024 * 1024);
        parentPort.postMessage({ success: true, result: finalResult, memoryUsedMB: Math.max(0, memUsed) });
    } catch (err) {
        const memAfter = process.memoryUsage();
        const memUsed = (memAfter.heapUsed - mem.heapUsed) / (1024 * 1024);
        parentPort.postMessage({ success: false, error: err.message || String(err), memoryUsedMB: Math.max(0, memUsed) });
    }
})();
`;
}

/**
 * PluginSandbox provides isolated execution of plugin code using worker_threads.
 * Enforces memory, timeout, and filesystem restrictions.
 */
export class PluginSandbox {
    private readonly config: SandboxConfig;

    /** @param config - Partial sandbox configuration (merged with defaults). */
    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Execute code string inside a sandboxed worker thread.
     * @param code - The JavaScript code to execute.
     * @returns SandboxResult with execution outcome and resource metrics.
     */
    async execute<T = RuntimeValue>(code: string): Promise<SandboxResult<T>> {
        const startTime = Date.now();
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), this.config.maxExecutionTimeMs);

        try {
            return await this.runWorker<T>(code, ac.signal, startTime);
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Validate whether a given file path is accessible under current config.
     * @param targetPath - The filesystem path to check.
     * @returns True if the path is allowed.
     */
    isPathAllowed(targetPath: string): boolean {
        const resolved: string = path.resolve(targetPath);

        for (const denied of this.config.deniedPaths) {
            if (resolved.startsWith(path.resolve(denied))) {return false;}
        }
        if (this.config.allowedPaths.length === 0) {return true;}

        for (const allowed of this.config.allowedPaths) {
            if (resolved.startsWith(path.resolve(allowed))) {return true;}
        }
        return false;
    }

    /** @returns The current sandbox configuration. */
    getConfig(): Readonly<SandboxConfig> {
        return { ...this.config };
    }

    /**
     * Spawn a worker thread and await its result.
     * @param code - Code to run in the worker.
     * @param signal - AbortSignal for timeout enforcement.
     * @param startTime - Timestamp used to compute execution duration.
     */
    private runWorker<T>(code: string, signal: AbortSignal, startTime: number): Promise<SandboxResult<T>> {
        return new Promise((resolve) => {
            const workerData: WorkerRequest = {
                code,
                allowedPaths: this.config.allowedPaths,
                deniedPaths: this.config.deniedPaths,
                networkAccess: this.config.networkAccess,
            };

            const worker = new Worker(buildWorkerScript(), {
                eval: true,
                workerData,
                resourceLimits: {
                    maxOldGenerationSizeMb: this.config.maxMemoryMB,
                },
            });

            const onAbort = (): void => {
                worker.terminate().catch(() => { /* already terminating */ });
                const elapsed = Date.now() - startTime;
                appLogger.warn('PluginSandbox', `Execution timed out after ${elapsed}ms`);
                resolve({ success: false, error: 'Execution timed out', executionTimeMs: elapsed, memoryUsedMB: 0 });
            };

            if (signal.aborted) { onAbort(); return; }
            signal.addEventListener('abort', onAbort, { once: true });

            worker.on('message', (msg: WorkerResponse) => {
                signal.removeEventListener('abort', onAbort);
                const elapsed = Date.now() - startTime;
                appLogger.debug('PluginSandbox', `Execution completed in ${elapsed}ms, memory: ${msg.memoryUsedMB.toFixed(2)}MB`);
                resolve({
                    success: msg.success,
                    result: msg.success ? (msg.result as T) : undefined,
                    error: msg.error,
                    executionTimeMs: elapsed,
                    memoryUsedMB: msg.memoryUsedMB,
                });
            });

            worker.on('error', (err: Error) => {
                signal.removeEventListener('abort', onAbort);
                const elapsed = Date.now() - startTime;
                appLogger.error('PluginSandbox', 'Worker error', err);
                resolve({ success: false, error: err.message, executionTimeMs: elapsed, memoryUsedMB: 0 });
            });
        });
    }
}

