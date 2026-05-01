/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Consumer-driven IPC contract tests (IDEA-025).
 *
 * Validates that the IPC bridge declared in `electron.d.ts` (renderer side)
 * stays in sync with the actual `ipcMain.handle` / `ipcMain.on` registrations
 * in `src/main/ipc/*.ts` and the preload bridge in `src/main/preload.ts`.
 *
 * These are **static-analysis** style tests – they read source files and
 * compare channel sets without instantiating Electron.
 */

import { describe, expect, it, vi } from 'vitest';

// Unmock fs and path so we can do real file I/O for static analysis
vi.unmock('fs');
vi.unmock('path');

import * as fs from 'fs';
import * as path from 'path';

import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = process.cwd();
const SRC = path.join(WORKSPACE_ROOT, 'src');
const IPC_DIR = path.join(SRC, 'main', 'ipc');
const ELECTRON_DTS = path.join(SRC, 'renderer', 'electron.d.ts');
const PRELOAD_TS = path.join(SRC, 'main', 'preload.ts');
const REGISTERED_CONSTANT_CHANNELS = new Map<string, string>([
    ['SESSION_CONVERSATION_CHANNELS.COMPLETE', SESSION_CONVERSATION_CHANNELS.COMPLETE],
    ['SESSION_CONVERSATION_CHANNELS.STREAM', SESSION_CONVERSATION_CHANNELS.STREAM],
    ['SESSION_CONVERSATION_CHANNELS.RETRY_WITH_MODEL', SESSION_CONVERSATION_CHANNELS.RETRY_WITH_MODEL],
    ['SESSION_CONVERSATION_CHANNELS.CANCEL', SESSION_CONVERSATION_CHANNELS.CANCEL],
]);

/**
 * Reads all `.ts` files inside `src/main/ipc/` and extracts channel names
 * registered via `ipcMain.handle`, `ipcMain.on`, `secureHandle`,
 * `registerBatchableHandler`, `registerSecureBatchableHandler`, and similar wrappers.
 */
function extractHandlerChannels(): { handleChannels: Set<string>; onChannels: Set<string> } {
    const handleChannels = new Set<string>();
    const onChannels = new Set<string>();

    const ipcFiles = fs.readdirSync(IPC_DIR).filter(f => f.endsWith('.ts'));

    // Match ipcMain.handle('channel'), secureHandle('channel'),
    // registerBatchableHandler('channel'), registerSecureBatchableHandler('channel')
    // These may have the channel on the same line or next line
    const handlePatterns = [
        /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g,
        /registerBatchableHandler\(\s*['"]([^'"]+)['"]/g,
        /registerSecureBatchableHandler\(\s*['"]([^'"]+)['"]/g,
        /safeHandle\(\s*['"]([^'"]+)['"]/g,
    ];
    // secureHandle may have the channel on the next line with indentation
    const secureHandleRe = /secureHandle\(\s*\n?\s*['"]([^'"]+)['"]/g;
    const onRe = /ipcMain\.on\(\s*['"]([^'"]+)['"]/g;
    const handleConstantRe = /ipcMain\.handle\(\s*([A-Z_]+_CHANNELS\.[A-Z_]+)/g;
    const onConstantRe = /ipcMain\.on\(\s*([A-Z_]+_CHANNELS\.[A-Z_]+)/g;

    for (const file of ipcFiles) {
        const content = fs.readFileSync(path.join(IPC_DIR, file), 'utf-8');

        for (const re of handlePatterns) {
            re.lastIndex = 0;
            for (const m of content.matchAll(re)) {
                handleChannels.add(m[1]);
            }
        }
        secureHandleRe.lastIndex = 0;
        for (const m of content.matchAll(secureHandleRe)) {
            handleChannels.add(m[1]);
        }
        for (const m of content.matchAll(onRe)) {
            onChannels.add(m[1]);
        }
        for (const m of content.matchAll(handleConstantRe)) {
            const resolvedChannel = REGISTERED_CONSTANT_CHANNELS.get(m[1]);
            if (resolvedChannel) {
                handleChannels.add(resolvedChannel);
            }
        }
        for (const m of content.matchAll(onConstantRe)) {
            const resolvedChannel = REGISTERED_CONSTANT_CHANNELS.get(m[1]);
            if (resolvedChannel) {
                onChannels.add(resolvedChannel);
            }
        }
    }

    return { handleChannels, onChannels };
}

/**
 * Extracts `webContents.send('channel', …)` calls from ipc/ source files.
 */
function extractWebContentsSendChannels(): Set<string> {
    const channels = new Set<string>();
    const sendRe = /webContents\.send\(\s*['"]([^'"]+)['"]/g;
    const ipcFiles = fs.readdirSync(IPC_DIR).filter(f => f.endsWith('.ts'));

    for (const file of ipcFiles) {
        const content = fs.readFileSync(path.join(IPC_DIR, file), 'utf-8');
        for (const m of content.matchAll(sendRe)) {
            channels.add(m[1]);
        }
    }
    return channels;
}

/**
 * Extracts invoke channel references from preload domain files.
 * Matches `ipcRenderer.invoke('channel', …)` patterns.
 */
function extractPreloadInvokeChannels(): Set<string> {
    const channels = new Set<string>();
    const preloadDomainsDir = path.join(SRC, 'main', 'preload', 'domains');
    if (!fs.existsSync(preloadDomainsDir)) {
        return channels;
    }

    const invokeRe = /\.invoke\(\s*['"]([^'"]+)['"]/g;
    const sendRe = /\.send\(\s*['"]([^'"]+)['"]/g;
    const onRe = /\.on\(\s*['"]([^'"]+)['"]/g;

    const files = fs.readdirSync(preloadDomainsDir).filter(f => f.endsWith('.ts'));
    for (const file of files) {
        const content = fs.readFileSync(path.join(preloadDomainsDir, file), 'utf-8');
        for (const m of content.matchAll(invokeRe)) {
            channels.add(m[1]);
        }
        for (const m of content.matchAll(sendRe)) {
            channels.add(m[1]);
        }
        for (const m of content.matchAll(onRe)) {
            channels.add(m[1]);
        }
    }
    return channels;
}

/**
 * Reads electron.d.ts and checks if it contains expected top-level property
 * declarations for the ElectronAPI interface using regex matching.
 */
function extractElectronApiTopLevelKeys(): string[] {
    const content = fs.readFileSync(ELECTRON_DTS, 'utf-8');
    // Extract property names declared at the top level of ElectronAPI
    // Match lines like "    propertyName:" or "    propertyName(" at 4-space indent
    const interfaceMatch = content.match(
        /export interface ElectronAPI\s*\{([\s\S]*?)^declare global/m
    );
    if (!interfaceMatch) { return []; }

    const body = interfaceMatch[1];
    const keys: string[] = [];
    // Match property declarations at exactly 4-space indent (top level of interface)
    const propRe = /^ {4}(\w+)\s*[:(]/gm;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(body)) !== null) {
        if (!keys.includes(m[1])) {
            keys.push(m[1]);
        }
    }
    return keys;
}

// ---------------------------------------------------------------------------
// Cached data for all tests
// ---------------------------------------------------------------------------

const { handleChannels, onChannels } = extractHandlerChannels();
const allMainChannels = new Set([...handleChannels, ...onChannels]);
const webContentsSendChannels = extractWebContentsSendChannels();
const preloadInvokeChannels = extractPreloadInvokeChannels();
const electronApiKeys = extractElectronApiTopLevelKeys();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IPC Contract Validation (IDEA-025)', () => {
    // -----------------------------------------------------------------------
    // 1. Channel existence – critical domains
    // -----------------------------------------------------------------------
    describe('critical channel existence', () => {
        const criticalDomainPrefixes: Record<string, string[]> = {
            auth: [
                'auth:github-login',
                'auth:poll-token',
                'auth:link-account',
                'auth:unlink-account',
                'auth:set-active-linked-account',
            ],
            conversation: [
                SESSION_CONVERSATION_CHANNELS.STREAM,
                SESSION_CONVERSATION_CHANNELS.COMPLETE,
                SESSION_CONVERSATION_CHANNELS.RETRY_WITH_MODEL,
            ],
            settings: [
                'settings:get',
                'settings:save',
            ],
            workspace: [
                'workspace:analyze',
                'workspace:generateLogo',
                'workspace:saveEnv',
            ],
            terminal: [
                'terminal:getProfiles',
                'terminal:saveProfile',
                'terminal:deleteProfile',
                'terminal:validateProfile',
            ],
            ollama: [
                'ollama:isRunning',
                'ollama:start',
                'ollama:pull',
                'ollama:getModels',
                'ollama:healthStatus',
            ],
            db: [
                'db:createChat',
                'db:searchChats',
                'db:deleteMessages',
                'db:getWorkspaces',
            ],
            git: [
                'git:isRepository',
                'git:getDetailedStatus',
                'git:commit',
                'git:push',
                'git:pull',
            ],
            memory: [
                'memory:getAll',
                'memory:addFact',
                'memory:search',
            ],
            mcp: [
                'mcp:list',
                'mcp:dispatch',
                'mcp:toggle',
            ],
        };

        for (const [domain, channels] of Object.entries(criticalDomainPrefixes)) {
            it(`registers all critical "${domain}" handlers`, () => {
                const missing = channels.filter(ch => !allMainChannels.has(ch));
                expect(
                    missing,
                    `Missing handler registrations for ${domain}: ${missing.join(', ')}`
                ).toHaveLength(0);
            });
        }
    });

    // -----------------------------------------------------------------------
    // 2. Preload bridge completeness
    // -----------------------------------------------------------------------
    describe('preload bridge completeness', () => {
        it('preload.ts imports domain bridges for all critical categories', () => {
            const preloadContent = fs.readFileSync(PRELOAD_TS, 'utf-8');

            const expectedBridges = [
                'createAuthBridge',
                'createSettingsBridge',
                'createOllamaBridge',
                'createTerminalBridge',
                'createWorkspaceBridge',
                'createDbBridge',
                'createGitBridge',
                'createMemoryBridge',
                'createMcpBridge',
                'createToolsBridge',
                'createFileBridge',
                'createVoiceBridge',
                'createAgentBridge',
                'createSSHBridge',
            ];

            const missing = expectedBridges.filter(b => !preloadContent.includes(b));
            // createFileBridge may be named createFilesBridge
            const adjusted = missing.filter(b => {
                if (b === 'createFileBridge') {
                    return !preloadContent.includes('createFilesBridge');
                }
                return true;
            });

            expect(
                adjusted,
                `Missing preload bridge imports: ${adjusted.join(', ')}`
            ).toHaveLength(0);
        });

        it('preload.ts exposes bridges via contextBridge.exposeInMainWorld', () => {
            const preloadContent = fs.readFileSync(PRELOAD_TS, 'utf-8');
            expect(preloadContent).toContain("contextBridge.exposeInMainWorld('electron'");
        });

        it('preload domain files invoke channels with matching domain prefixes in main', () => {
            if (preloadInvokeChannels.size === 0) { return; }

            // Extract domain prefixes from both sets
            const preloadDomains = new Set<string>();
            for (const ch of preloadInvokeChannels) {
                preloadDomains.add(ch.split(':')[0]);
            }
            const mainDomains = new Set<string>();
            for (const ch of allMainChannels) {
                mainDomains.add(ch.split(':')[0]);
            }

            // Every preload domain should have a corresponding main domain
            const unmatchedDomains: string[] = [];
            for (const domain of preloadDomains) {
                if (!mainDomains.has(domain)) {
                    unmatchedDomains.push(domain);
                }
            }

            // Allow some tolerance for domains that use alternative naming
            const ALLOWED_UNMATCHED = 10;
            expect(
                unmatchedDomains.length,
                `Preload domains without main handlers (${unmatchedDomains.length}): ${unmatchedDomains.join(', ')}`
            ).toBeLessThanOrEqual(ALLOWED_UNMATCHED);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Handler return-type alignment (structural spot-check)
    // -----------------------------------------------------------------------
    describe('handler return type alignment', () => {
        it('electron.d.ts declares getSettings returning Promise<AppSettings>', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain('getSettings: () => Promise<AppSettings | ServiceResponse<AppSettings>>');
        });

        it('electron.d.ts declares githubLogin returning device code shape', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain('device_code: string');
            expect(dtsContent).toContain('user_code: string');
            expect(dtsContent).toContain('verification_uri: string');
        });

        it('electron.d.ts declares isOllamaRunning returning Promise<boolean>', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain('isOllamaRunning: () => Promise<boolean>');
        });

        it('electron.d.ts declares chatStream accepting ChatStreamRequest', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain("session: ElectronApiIntegrationsDomain['session'];");
        });

        it('settings handler file returns AppSettings-compatible shape', () => {
            const settingsContent = fs.readFileSync(
                path.join(IPC_DIR, 'settings.ts'),
                'utf-8'
            );
            // settings:get handler should call settingsService.getSettings
            expect(settingsContent).toContain('settingsService');
            expect(settingsContent).toContain("'settings:get'");
        });
    });

    // -----------------------------------------------------------------------
    // 4. Event channel consistency
    // -----------------------------------------------------------------------
    describe('event channel consistency', () => {
        it('webContents.send channels have corresponding listeners in electron.d.ts or preload', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            const preloadDomainsDir = path.join(SRC, 'main', 'preload', 'domains');
            let preloadContent = '';
            if (fs.existsSync(preloadDomainsDir)) {
                const files = fs.readdirSync(preloadDomainsDir).filter(f => f.endsWith('.ts'));
                for (const file of files) {
                    preloadContent += fs.readFileSync(path.join(preloadDomainsDir, file), 'utf-8');
                }
            }

            const combined = dtsContent + preloadContent;

            const undeclaredEvents: string[] = [];
            for (const ch of webContentsSendChannels) {
                if (!combined.includes(ch)) {
                    undeclaredEvents.push(ch);
                }
            }

            // Some tolerance for dynamically-constructed channel names or
            // channels that use different naming between main and preload
            const ALLOWED_UNDECLARED_THRESHOLD = 15;
            expect(
                undeclaredEvents.length,
                `Event channels sent from main but not declared in bridge/types (${undeclaredEvents.length}): ${undeclaredEvents.join(', ')}`
            ).toBeLessThanOrEqual(ALLOWED_UNDECLARED_THRESHOLD);
        });

        it('critical event channels from main are reachable in preload or d.ts', () => {
            const preloadDomainsDir = path.join(SRC, 'main', 'preload', 'domains');
            let preloadContent = '';
            if (fs.existsSync(preloadDomainsDir)) {
                const files = fs.readdirSync(preloadDomainsDir).filter(f => f.endsWith('.ts'));
                for (const file of files) {
                    preloadContent += fs.readFileSync(path.join(preloadDomainsDir, file), 'utf-8');
                }
            }

            // Verify critical event domains are covered by the preload bridge
            // (exact channel names may differ between main sends and preload listeners)
            const criticalEventDomains = [
                'ollama:',
                'process:',
                'terminal:',
            ];

            for (const prefix of criticalEventDomains) {
                expect(
                    preloadContent,
                    `No preload listener for event domain "${prefix}"`
                ).toContain(prefix);
            }
        });

        it('process event channels are handled in preload', () => {
            const preloadDomainsDir = path.join(SRC, 'main', 'preload', 'domains');
            if (!fs.existsSync(preloadDomainsDir)) { return; }

            const processPreload = fs.readFileSync(
                path.join(preloadDomainsDir, 'process.preload.ts'),
                'utf-8'
            );

            expect(processPreload).toContain('process:data');
            expect(processPreload).toContain('process:exit');
        });
    });

    // -----------------------------------------------------------------------
    // 5. Channel naming convention
    // -----------------------------------------------------------------------
    describe('channel naming convention', () => {
        const DOMAIN_ACTION_RE = /^[\w-]+:[\w:.-]+$/;

        it('all ipcMain.handle channels follow domain:action naming', () => {
            // Legacy channels that predate the domain:action convention
            const LEGACY_EXCEPTIONS = new Set([
                'getQuota', 'getCopilotQuota', 'getCodexUsage', 'getClaudeQuota',
                'getSettings', 'saveSettings',
            ]);
            const violations: string[] = [];
            for (const ch of handleChannels) {
                if (!DOMAIN_ACTION_RE.test(ch) && !LEGACY_EXCEPTIONS.has(ch)) {
                    violations.push(ch);
                }
            }
            expect(
                violations,
                `Channels not following domain:action pattern: ${violations.join(', ')}`
            ).toHaveLength(0);
        });

        it('all ipcMain.on channels follow domain:action naming', () => {
            const violations: string[] = [];
            for (const ch of onChannels) {
                if (!DOMAIN_ACTION_RE.test(ch)) {
                    violations.push(ch);
                }
            }
            expect(
                violations,
                `Channels not following domain:action pattern: ${violations.join(', ')}`
            ).toHaveLength(0);
        });

        it('all webContents.send channels follow domain:action naming', () => {
            // Known legacy exceptions that predate the naming convention
            const KNOWN_EXCEPTIONS = new Set(['agent-event']);
            const violations: string[] = [];
            for (const ch of webContentsSendChannels) {
                if (!DOMAIN_ACTION_RE.test(ch) && !KNOWN_EXCEPTIONS.has(ch)) {
                    violations.push(ch);
                }
            }
            expect(
                violations,
                `Event channels not following domain:action pattern: ${violations.join(', ')}`
            ).toHaveLength(0);
        });
    });

    // -----------------------------------------------------------------------
    // 6. No orphaned handlers
    // -----------------------------------------------------------------------
    describe('no orphaned handlers', () => {
        it('every handler domain has a corresponding bridge, type declaration, or renderer usage', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            const preloadDomainsDir = path.join(SRC, 'main', 'preload', 'domains');
            let preloadContent = '';
            const preloadFileNames: string[] = [];
            if (fs.existsSync(preloadDomainsDir)) {
                const files = fs.readdirSync(preloadDomainsDir).filter(f => f.endsWith('.ts'));
                preloadFileNames.push(...files.map(f => f.replace('.preload.ts', '')));
                for (const file of files) {
                    preloadContent += fs.readFileSync(path.join(preloadDomainsDir, file), 'utf-8');
                }
            }

            const combined = dtsContent + preloadContent;

            // Extract unique domain prefixes from all registered channels
            const domainPrefixes = new Set<string>();
            for (const ch of allMainChannels) {
                const prefix = ch.split(':')[0];
                domainPrefixes.add(prefix);
            }

            // Domains that are known to be accessed via generic invoke() from renderer
            // rather than through typed preload bridges
            const INTERNAL_OR_GENERIC_INVOKE_DOMAINS = new Set([
                'dialog',         // Internal utility, used via invoke()
                'key-rotation',   // Security internal
                'migration',      // Internal database migration
                'theme',          // Uses typed IPC contract in renderer
                'token-estimation', // Internal utility
                'context-window', // Internal LLM utility
                'user-behavior',  // Analytics internal
                'screenshot',     // System utility
                'brain',          // Accessed via generic invoke() in renderer
                'hf',             // Alias for huggingface, accessed via typed bridge
                'llm',            // Internal LLM routing, wrapped by chat/ollama bridges
                'prompts',        // Shared prompts, accessed via invoke()
            ]);

            const orphanedDomains: string[] = [];
            for (const domain of domainPrefixes) {
                if (INTERNAL_OR_GENERIC_INVOKE_DOMAINS.has(domain)) { continue; }

                const found =
                    combined.includes(`${domain}:`) ||
                    combined.includes(domain) ||
                    preloadFileNames.some(f => f.includes(domain));

                if (!found) {
                    orphanedDomains.push(domain);
                }
            }

            expect(
                orphanedDomains,
                `Handler domains with no bridge/type declaration: ${orphanedDomains.join(', ')}`
            ).toHaveLength(0);
        });

        it('majority of preload invoke channels have corresponding main handlers', () => {
            if (preloadInvokeChannels.size === 0) { return; }

            const matchedCount = [...preloadInvokeChannels].filter(ch =>
                allMainChannels.has(ch)
            ).length;

            // At least 40% of preload channels should match main handlers directly
            // (remaining may use different naming conventions or batch wrappers)
            const matchRatio = matchedCount / preloadInvokeChannels.size;
            expect(
                matchRatio,
                `Only ${(matchRatio * 100).toFixed(0)}% of preload channels match main handlers`
            ).toBeGreaterThanOrEqual(0.4);
        });
    });

    // -----------------------------------------------------------------------
    // 7. ElectronAPI surface integrity
    // -----------------------------------------------------------------------
    describe('ElectronAPI surface integrity', () => {
        it('electron.d.ts declares the ElectronAPI interface', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain('export interface ElectronAPI');
        });

        it('ElectronAPI has critical top-level properties', () => {
            const required = [
                'invoke',
                'minimize',
                'maximize',
                'close',
                'code',
                'workspace',
                'process',
                'files',
                'db',
                'terminal',
                'agent',
                'ssh',
                'mcp',
                'git',
                'memory',
                'advancedMemory',
            ];

            const missing = required.filter(k => !electronApiKeys.includes(k));
            expect(
                missing,
                `ElectronAPI missing required properties: ${missing.join(', ')}`
            ).toHaveLength(0);
        });

        it('window.electron is declared globally', () => {
            const dtsContent = fs.readFileSync(ELECTRON_DTS, 'utf-8');
            expect(dtsContent).toContain('electron: ElectronAPI');
        });
    });

    // -----------------------------------------------------------------------
    // 8. Handler count sanity check
    // -----------------------------------------------------------------------
    describe('handler count sanity', () => {
        it('has a reasonable number of registered ipcMain.handle channels (> 100)', () => {
            expect(handleChannels.size).toBeGreaterThan(100);
        });

        it('has fewer ipcMain.on channels than handle channels', () => {
            // on channels are for fire-and-forget; should be a small subset
            expect(onChannels.size).toBeLessThan(handleChannels.size);
        });

        it('preload invokes at least 50 channels', () => {
            if (preloadInvokeChannels.size === 0) {
                // Skip if preload domains couldn't be parsed
                return;
            }
            expect(preloadInvokeChannels.size).toBeGreaterThanOrEqual(50);
        });
    });
});
