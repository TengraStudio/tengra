import { exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { promisify } from 'util';

import { pushLogEntry } from '@main/ipc/logging';
import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { AuthService } from '@main/services/security/auth.service';
import { getManagedRuntimeBinaryPath } from '@main/services/system/runtime-path.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getMainWindow } from '@main/startup/window';
import { JsonObject } from '@shared/types/common';
import { AppErrorCode, getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import type { ChildProcess } from 'child_process';

import { validateOAuthTimeoutMs } from './proxy-validation.util';

/**
 * Performance budgets in milliseconds for ProxyProcessManager operations
 */
export const PROXY_PROCESS_PERFORMANCE_BUDGETS = {
    CONFIG_GENERATION_MS: 2000,
    START_MS: 10000,
    STOP_MS: 5000
} as const;

export interface ProxyEmbedStatus {
    running: boolean;
    pid?: number;
    port?: number;
    binaryPath?: string;
    attached?: boolean;
    error?: string;
    errorCode?: string;
}

interface ProxyRuntimeLaunchConfig {
    managementPassword: string;
    port: number;
    proxyApiKey: string;
}

interface OAuthTimeoutConfig {
    default?: number;
    codex?: number;
    claude?: number;
    antigravity?: number;
    ollama?: number;
}

export class ProxyProcessManager {
    private child: ChildProcess | null = null;
    private currentPort: number = 8317;
    private stdoutBuffer = '';
    private stderrBuffer = '';
    private isProxyRunning: boolean = false;

    constructor(
        private settingsService: SettingsService,
        private authService: AuthService,
        private databaseService: DatabaseService
    ) { }

    async start(options?: { port?: number; persistent?: boolean }): Promise<ProxyEmbedStatus> {
        const startTime = performance.now();
        if (this.child) {
            return this.getStatus();
        }

        try {
            this.currentPort = options?.port ?? 8317;

            if (await this.isExistingProxyHealthy(this.currentPort)) {
                this.isProxyRunning = true;
                appLogger.info('Proxy', `Reusing existing tengra-proxy on port ${this.currentPort}`);
                return {
                    running: true,
                    port: this.currentPort,
                    attached: true,
                };
            }

            await this.ensureBridgePortAvailable(1455);
            const binaryPath = await this.ensureBinary();
            const runtimeConfig = await this.generateConfig(this.currentPort);

            this.spawnProxyProcess(binaryPath, runtimeConfig, options?.persistent);

            await this.waitForHealthy(this.currentPort);

            appLogger.info('Proxy', `Embedded proxy started successfully on port ${this.currentPort} in ${Math.round(performance.now() - startTime)}ms`);
            this.isProxyRunning = true;

            const status = this.getStatus();
            status.binaryPath = binaryPath;
            return status;

        } catch (error) {
            appLogger.error('Proxy', `Failed to start embedded proxy: ${getErrorMessage(error)}`);
            this.stopSync();
            const errorMessage = getErrorMessage(error);
            return {
                running: false,
                error: errorMessage,
                errorCode: errorMessage.toLowerCase().includes('1455')
                    ? AppErrorCode.PROXY_PORT_IN_USE
                    : AppErrorCode.PROXY_START_FAILED
            };
        }
    }

    async stop(): Promise<void> {
        if (!this.child) {
            this.isProxyRunning = false;
            return;
        }

        try {
            this.child.kill('SIGTERM');
            const killTimeout = setTimeout(() => {
                if (this.child) {
                    this.child.kill('SIGKILL');
                }
            }, PROXY_PROCESS_PERFORMANCE_BUDGETS.STOP_MS);

            await new Promise<void>((resolve) => {
                this.child?.on('exit', () => {
                    clearTimeout(killTimeout);
                    resolve();
                });
            });
        } finally {
            this.flushLogBuffers();
            this.child = null;
            this.isProxyRunning = false;
        }
    }

    stopSync(): void {
        const child = this.child;
        this.child = null;
        this.isProxyRunning = false;
        this.flushLogBuffers();
        if (child) {
            try {
                child.kill('SIGKILL');
            } catch {
                // Ignore errors on sync stop
            }
        }
    }

    private spawnProxyProcess(
        binaryPath: string,
        runtimeConfig: ProxyRuntimeLaunchConfig,
        persistent?: boolean
    ): void {
        appLogger.info('Proxy', `Spawning ${binaryPath} with port=${runtimeConfig.port}`);
        const oauthTimeoutEnv = this.buildOAuthTimeoutEnv();
        const ollamaBaseUrlEnv = this.buildOllamaBaseUrlEnv();

        this.child = spawn(
            binaryPath,
            [
                "--proxy",
                runtimeConfig.port.toString(),
            ],
            {
                cwd: path.dirname(binaryPath),
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                detached: persistent === true,
                env: {
                    ...process.env,
                    TENGRA_PROXY_PERSISTENT: persistent ? 'true' : 'false',
                    TENGRA_DB_SERVICE_TOKEN: process.env.TENGRA_DB_SERVICE_TOKEN || '',
                    TENGRA_MASTER_KEY_HEX: this.authService.getRuntimeMasterKeyHex() ?? '',
                    // OS native encryption hint
                    TENGRA_USE_OS_SECURITY: 'true',
                    ...oauthTimeoutEnv,
                    ...ollamaBaseUrlEnv,
                }
            }
        );

        if (persistent) {
            this.child.unref();
        }

        this.child.stdout?.on('data', (chunk) => {
            this.stdoutBuffer = this.logProxyChunk(this.stdoutBuffer, chunk.toString(), 'info');
        });

        this.child.stderr?.on('data', (chunk) => {
            this.stderrBuffer = this.logProxyChunk(this.stderrBuffer, chunk.toString(), 'error');
        });

        this.child.on('error', (error) => {
            appLogger.error('Proxy', `Embedded proxy process error: ${error.message}`);
            this.isProxyRunning = false;
        });

        this.child.on('exit', (code, signal) => {
            this.isProxyRunning = false;
            this.flushLogBuffers();
            this.child = null;
            if (code !== 0 && code !== null) {
                appLogger.error('Proxy', `Embedded proxy exited with code ${code} (Signal: ${signal})`);
            } else {
                appLogger.info('Proxy', 'Embedded proxy process terminated cleanly');
            }
        });
    }

    private buildOAuthTimeoutEnv(): Record<string, string> {
        const settings = this.settingsService.getSettings();
        const timeoutConfig = settings.proxy?.oauthTimeoutMs as OAuthTimeoutConfig | undefined;
        if (!timeoutConfig) {
            return {};
        }

        const env: Record<string, string> = {};
        const timeoutEntries: Array<{
            key: keyof OAuthTimeoutConfig;
            envKey: string;
        }> = [
            { key: 'default', envKey: 'TENGRA_OAUTH_TIMEOUT_SECS' },
            { key: 'codex', envKey: 'TENGRA_OAUTH_TIMEOUT_CODEX_SECS' },
            { key: 'claude', envKey: 'TENGRA_OAUTH_TIMEOUT_CLAUDE_SECS' },
            { key: 'antigravity', envKey: 'TENGRA_OAUTH_TIMEOUT_ANTIGRAVITY_SECS' },
            { key: 'ollama', envKey: 'TENGRA_OAUTH_TIMEOUT_OLLAMA_SECS' },
        ];

        for (const entry of timeoutEntries) {
            const timeoutMs = timeoutConfig[entry.key];
            if (timeoutMs === undefined) {
                continue;
            }

            const validationError = validateOAuthTimeoutMs(timeoutMs);
            if (validationError) {
                throw new Error(`Invalid OAuth timeout for ${entry.key}: ${validationError}`);
            }

            env[entry.envKey] = Math.round(timeoutMs / 1000).toString();
        }

        return env;
    }

    private buildOllamaBaseUrlEnv(): Record<string, string> {
        const settings = this.settingsService.getSettings();
        const configuredUrl = settings.ollama?.url?.trim();
        if (!configuredUrl) {
            return {};
        }

        return {
            TENGRA_OLLAMA_BASE_URL: configuredUrl,
        };
    }

    private async waitForHealthy(port: number, timeoutMs: number = 20000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const isHealthy = await this.isExistingProxyHealthy(port);
            if (isHealthy) {
                return;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        throw new Error(`Timeout waiting for proxy health at port ${port}`);
    }

    private async isExistingProxyHealthy(port: number): Promise<boolean> {
        return await new Promise((resolve) => {
            const request = http.get(
                {
                    host: '127.0.0.1',
                    path: '/health',
                    port,
                    timeout: 750,
                },
                response => {
                    response.resume();
                    resolve(response.statusCode === 200);
                }
            );
            request.on('error', () => resolve(false));
            request.on('timeout', () => {
                request.destroy();
                resolve(false);
            });
        });
    }

    private async ensureBridgePortAvailable(port: number): Promise<void> {
        const isOpen = await this.isPortAcceptingConnections(port);
        if (isOpen) {
            throw new Error(`OAuth bridge callback port ${port} is already occupied`);
        }
    }

    private async isPortAcceptingConnections(port: number): Promise<boolean> {
        return await new Promise((resolve) => {
            const socket = net.createConnection(port, '127.0.0.1');
            socket.setTimeout(250);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                resolve(false);
            });
        });
    }

    getStatus(): ProxyEmbedStatus {
        return {
            running: this.isProxyRunning || !!this.child,
            pid: this.child?.pid,
            port: this.currentPort,
        };
    }

    private getBinaryPath(): string {
        return getManagedRuntimeBinaryPath('tengra-proxy');
    }

    private getSourceDir(): string {
        return path.join(process.cwd(), 'src', 'native', 'tengra-proxy');
    }

    private resolveCargoCommand(): string {
        const explicitCargo = process.env.CARGO?.trim();
        if (explicitCargo) {
            return explicitCargo;
        }

        const homeDir = process.platform === 'win32'
            ? process.env.USERPROFILE ?? ''
            : process.env.HOME ?? '';
        const localCargo = process.platform === 'win32'
            ? path.join(homeDir, '.cargo', 'bin', 'cargo.exe')
            : path.join(homeDir, '.cargo', 'bin', 'cargo');

        if (localCargo && fs.existsSync(localCargo)) {
            return `"${localCargo}"`;
        }

        return 'cargo';
    }

    private async ensureBinary(): Promise<string> {
        const binaryPath = this.getBinaryPath();
        const binaryExists = await fs.promises.access(binaryPath, fs.constants.F_OK).then(() => true).catch(() => false);
        if (binaryExists && !await this.shouldRebuild(binaryPath)) {
            return binaryPath;
        }

        const sourceDir = this.getSourceDir();
        const sourceDirExists = await fs.promises.access(sourceDir, fs.constants.F_OK).then(() => true).catch(() => false);
        if (!sourceDirExists) {
            appLogger.error('Proxy', `Source directory not found: ${sourceDir}`);
            if (binaryExists) {
                return binaryPath;
            }
            throw new Error(`Proxy source not found and binary missing: ${sourceDir}`);
        }

        appLogger.info('Proxy', 'Building tengra-proxy binary...');
        const buildCmd = `${this.resolveCargoCommand()} build --release`;
        const execAsync = promisify(exec);

        const { stdout, stderr } = await execAsync(buildCmd, { cwd: sourceDir });
        if (stdout?.trim()) {
            appLogger.info('Proxy:Build', stdout.trim());
        }
        if (stderr?.trim()) {
            appLogger.warn('Proxy:Build', stderr.trim());
        }

        // Ensure the managed runtime bin directory exists
        const binDir = path.dirname(binaryPath);
        const binDirExists = await fs.promises.access(binDir, fs.constants.F_OK).then(() => true).catch(() => false);
        if (!binDirExists) {
            await fs.promises.mkdir(binDir, { recursive: true });
        }

        // Move/Copy binary from target/release to the managed runtime directory
        const builtBinaryName = process.platform === 'win32' ? 'tengra-proxy.exe' : 'tengra-proxy';
        const builtBinary = path.join(sourceDir, 'target', 'release', builtBinaryName);
        const builtExists = await fs.promises.access(builtBinary, fs.constants.F_OK).then(() => true).catch(() => false);
        if (builtExists) {
            await fs.promises.copyFile(builtBinary, binaryPath);
            appLogger.info('Proxy', `Binary built and copied to: ${binaryPath}`);
        }

        const finalExists = await fs.promises.access(binaryPath, fs.constants.F_OK).then(() => true).catch(() => false);
        if (!finalExists) {
            throw new Error('Failed to build tengra-proxy binary');
        }
        return binaryPath;
    }

    private async shouldRebuild(binaryPath: string): Promise<boolean> {
        try {
            const binaryStat = await fs.promises.stat(binaryPath);
            const binaryMtime = binaryStat.mtimeMs;
            const sourceDir = this.getSourceDir();
            const sourceDirExists = await fs.promises.access(sourceDir, fs.constants.F_OK).then(() => true).catch(() => false);
            if (!sourceDirExists) {
                return false;
            }

            const inputs = this.collectBuildInputs(sourceDir);
            for (const file of inputs) {
                try {
                    const stat = await fs.promises.stat(file);
                    if (stat.mtimeMs > binaryMtime) {
                        return true;
                    }
                } catch {
                    // skip inaccessible files
                }
            }
            return false;
        } catch (e) {
            appLogger.debug('Proxy', `shouldRebuild check failed: ${getErrorMessage(e)}`);
            return false;
        }
    }

    private collectBuildInputs(dir: string): string[] {
        const results: string[] = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'target' || entry.name === 'node_modules') {
                        continue;
                    }
                    results.push(...this.collectBuildInputs(fullPath));
                    continue;
                }
                if (entry.name.endsWith('.rs') || entry.name === 'Cargo.toml' || entry.name === 'Cargo.lock') {
                    results.push(fullPath);
                }
            }
        } catch (e) {
            appLogger.debug('Proxy', `collectBuildInputs failed for ${dir}: ${getErrorMessage(e)}`);
        }
        return results;
    }

    private logProxyChunk(
        currentBuffer: string,
        chunk: string,
        defaultLevel: 'info' | 'error'
    ): string {
        const buffer = currentBuffer + chunk;
        const lines = buffer.split(/\r?\n/);
        const remainder = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }
            this.processProxyLogLine(line, defaultLevel);
        }
        return remainder;
    }

    private processProxyLogLine(line: string, defaultLevel: 'info' | 'error') {
        if (line.includes('__TENGRA_AUTH_UPDATE__:')) {
            const parts = line.split('__TENGRA_AUTH_UPDATE__:');
            const jsonContent = parts[1]?.trim();
            if (jsonContent) {
                void this.handleAuthUpdateFromProxy(jsonContent);
            }
            return;
        }
        if (line.includes('__TENGRA_AUTH_UPDATE_FAILURE__:')) {
            const parts = line.split('__TENGRA_AUTH_UPDATE_FAILURE__:');
            const jsonContent = parts[1]?.trim();
            appLogger.error('Proxy', `OAuth callback DB write failure: ${jsonContent ?? 'unknown'}`);
            return;
        }

        const level = this.detectLogLevel(line, defaultLevel);
        const message = line.trim();

        if (level === 'error') {
            appLogger.error('Proxy', message);
        } else if (level === 'warning') {
            appLogger.warn('Proxy', message);
        } else {
            appLogger.info('Proxy', message);
        }
        pushLogEntry(level === 'warning' ? 'warn' : level, 'Proxy', message);
    }

    private detectLogLevel(
        line: string,
        defaultLevel: 'info' | 'error'
    ): 'info' | 'warning' | 'error' {
        if (/level=info|\[INFO\]|\[LOG\]/i.test(line)) {
            return 'info';
        }
        if (/level=warn(ing)?|\[WARN\]/i.test(line)) {
            return 'warning';
        }
        if (/level=error|\[ERROR\]/i.test(line)) {
            return 'error';
        }
        return defaultLevel;
    }

    private async handleAuthUpdateFromProxy(json: string): Promise<void> {
        appLogger.debug('Proxy', 'Processing auth update from proxy...');
        const data = safeJsonParse<JsonObject>(json, {});
        if (!data) {
            appLogger.error('Proxy', 'Failed to parse auth update JSON');
            return;
        }

        try {
            await this.authService.updateFromProxy(data);
            await this.authService.reloadLinkedAccountsCache();
            this.emitRendererAuthUpdate(data);
        } catch (error) {
            appLogger.error('Proxy', `Failed to update auth from proxy: ${getErrorMessage(error)}`);
        }
    }

    private emitRendererAuthUpdate(data: JsonObject): void {
        const provider = typeof data.provider === 'string' ? data.provider : '';
        const accountId = typeof data.accountId === 'string' ? data.accountId : '';
        if (!provider || !accountId) {
            return;
        }

        const mainWindow = getMainWindow();
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.webContents.send('auth:account-changed', {
            type: 'updated',
            provider,
            accountId,
        });
    }

    private flushLogBuffers(): void {
        this.flushLogBuffer('info');
        this.flushLogBuffer('error');
    }

    private flushLogBuffer(defaultLevel: 'info' | 'error'): void {
        const remainder = defaultLevel === 'info' ? this.stdoutBuffer.trim() : this.stderrBuffer.trim();
        if (!remainder) {
            if (defaultLevel === 'info') {
                this.stdoutBuffer = '';
            } else {
                this.stderrBuffer = '';
            }
            return;
        }

        this.processProxyLogLine(remainder, defaultLevel);
        if (defaultLevel === 'info') {
            this.stdoutBuffer = '';
        } else {
            this.stderrBuffer = '';
        }
    }

    async generateConfig(port: number): Promise<ProxyRuntimeLaunchConfig> {
        await this.syncProviderCredentialsForProxyStartup();
        const proxyApiKey = await this.ensureProxyApiKey();
        const managementPassword = await this.ensureManagementPassword();

        // Persist proxy key in Database so tengra-proxy can use it
        try {
            const now = Date.now();
            await this.databaseService.exec(`
                INSERT INTO linked_accounts (id, provider, access_token, metadata, is_active, created_at, updated_at)
                VALUES ('proxy_key_default', 'proxy_key', '${proxyApiKey}', '{"type":"proxy_key"}', 1, ${now}, ${now})
                ON CONFLICT(id) DO UPDATE SET provider = EXCLUDED.provider, access_token = EXCLUDED.access_token, metadata = EXCLUDED.metadata, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at
            `);
            appLogger.info('Proxy', 'Proxy API key synchronized to database');
        } catch (e) {
            appLogger.error('Proxy', `Failed to synchronize proxy key to DB: ${getErrorMessage(e)}`);
            // Continue anyway, it might be a transient failure or DB not ready
        }

        const settings = this.settingsService.getSettings();
        const proxySettings = settings.proxy ?? { enabled: false, url: 'http://localhost:8317/v1', key: '' };
        const updatedProxy = {
            ...proxySettings,
            port,
            apiKey: proxyApiKey,
            managementPassword
        };
        await this.settingsService.saveSettings({
            ...settings,
            // SAFETY: The settings schema for 'proxy' will be expanded to include port, apiKey, and managementPassword.
            proxy: updatedProxy
        });

        return {
            port,
            proxyApiKey,
            managementPassword
        };
    }

    private async syncProviderCredentialsForProxyStartup(): Promise<void> {
        const settings = this.settingsService.getSettings();
        const providerTokens: Array<{ provider: string; token: string | undefined }> = [
            { provider: 'openai_key', token: settings.openai?.apiKey },
            { provider: 'anthropic_key', token: settings.anthropic?.apiKey },
            { provider: 'groq_key', token: settings.groq?.apiKey },
            { provider: 'nvidia_key', token: settings.nvidia?.apiKey },
        ];

        for (const { provider, token } of providerTokens) {
            const normalizedToken = token?.trim();
            if (!normalizedToken || normalizedToken.length <= 5 || normalizedToken === 'connected') {
                continue;
            }

            try {
                await this.authService.linkAccount(provider, { accessToken: normalizedToken });
            } catch (error) {
                appLogger.warn(
                    'Proxy',
                    `Failed to sync ${provider} credential before proxy startup: ${getErrorMessage(error)}`
                );
            }
        }
    }

    private async ensureProxyApiKey(): Promise<string> {
        const settings = this.settingsService.getSettings();
        if (settings.proxy?.apiKey) {
            return settings.proxy.apiKey;
        }

        const key = crypto.randomBytes(32).toString('hex');
        return key;
    }

    private async ensureManagementPassword(): Promise<string> {
        const settings = this.settingsService.getSettings();
        if (settings.proxy?.managementPassword) {
            return settings.proxy.managementPassword;
        }

        return crypto.randomBytes(16).toString('hex');
    }
}
