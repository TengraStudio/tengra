import { ChildProcess, exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { validatePort } from '@main/services/proxy/proxy-validation.util';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { getManagedRuntimeBinaryPath } from '@main/services/system/runtime-path.service';
import { SettingsService } from '@main/services/system/settings.service';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { JsonObject } from '@shared/types/common';
import { AppErrorCode, getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

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
    configPath?: string;
    binaryPath?: string;
    error?: string;
    errorCode?: string;
}

export class ProxyProcessManager {
    private child: ChildProcess | null = null;
    private currentPort: number = 8317;
    private stdoutBuffer = '';
    private stderrBuffer = '';
    private authApiKey: string = '';
    private isProxyRunning: boolean = false;

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
        private authService: AuthService,
        private authAPIService: AuthAPIService
    ) { }

    async start(options?: { port?: number; persistent?: boolean }): Promise<ProxyEmbedStatus> {
        const startTime = performance.now();
        if (this.child) {
            return this.getStatus();
        }

        if (options?.port !== undefined) {
            const portError = validatePort(options.port);
            if (portError) {
                appLogger.error('Proxy', `Invalid port: ${portError}`);
                return { running: false, error: portError, errorCode: AppErrorCode.PROXY_INVALID_CONFIG };
            }
        }

        const binaryPath = this.getBinaryPath();
        appLogger.info('Proxy', `Starting embedded proxy. Binary: ${binaryPath}`);

        try {
            await this.ensureBinary();
        } catch (e) {
            appLogger.error('Proxy', `Failed to ensure binary: ${getErrorMessage(e)}`);
            return { running: false, error: `Failed to build or find binary: ${getErrorMessage(e)}`, errorCode: AppErrorCode.PROXY_BINARY_NOT_FOUND };
        }

        this.currentPort = options?.port ?? 8317;

        // 1. Kill any existing proxy processes
        await this.killExistingProxyProcesses();

        // 2. Verify port is free
        const isPortTaken = await this.isPortBusy(this.currentPort);
        if (isPortTaken) {
            appLogger.warn(
                'Proxy',
                `Port ${this.currentPort} is still busy after kill. Retrying in 1s...`
            );
            await new Promise(resolve => setTimeout(resolve, OPERATION_TIMEOUTS.RETRY_DELAY));
            const stillTaken = await this.isPortBusy(this.currentPort);
            if (stillTaken) {
                appLogger.error(
                    'Proxy',
                    `Port ${this.currentPort} is occupied by another process and could not be freed.`
                );
                return { running: false, error: `Port ${this.currentPort} is already in use.`, errorCode: AppErrorCode.PROXY_PORT_IN_USE };
            }
        }

        // Get the auth API port to pass to the proxy
        const authAPIPort = this.setupAuthAPI();
        if (authAPIPort === 0) {
            appLogger.error('Proxy', 'AuthAPIService not initialized - port is 0');
            return { running: false, error: 'AuthAPIService not initialized', errorCode: AppErrorCode.PROXY_NOT_INITIALIZED };
        }

        // Generate YAML config
        const proxyConfigPath = await this.generateProxyConfigFile(this.currentPort);

        // 3. Spawn process
        this.spawnProxyProcess(binaryPath, proxyConfigPath, authAPIPort, options?.persistent);

        this.isProxyRunning = true;

        const elapsed = performance.now() - startTime;
        if (elapsed > PROXY_PROCESS_PERFORMANCE_BUDGETS.START_MS) {
            appLogger.warn('Proxy', `start exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PROCESS_PERFORMANCE_BUDGETS.START_MS}ms`);
        }

        return this.getStatus();
    }

    private async isPortBusy(port: number): Promise<boolean> {
        return new Promise(resolve => {
            const server = net
                .createServer()
                .once('error', (err: NodeJS.ErrnoException) => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                })
                .once('listening', () => {
                    server.close();
                    resolve(false);
                })
                .listen(port, '127.0.0.1');
        });
    }


    private setupAuthAPI(): number {
        const authAPIPort = this.authAPIService.getPort();
        if (authAPIPort === 0) {
            return 0;
        }

        this.authApiKey = crypto.randomBytes(32).toString('hex');
        const authApi = this.authAPIService as { setApiKey?: (key: string) => void };
        if (authApi.setApiKey) {
            authApi.setApiKey(this.authApiKey);
        }
        return authAPIPort;
    }

    private spawnProxyProcess(
        binaryPath: string,
        configPath: string,
        authPort: number,
        persistent?: boolean
    ) {
        const isDev = !app.isPackaged;

        // In dev mode, we avoid detached to let Electron clean it up properly
        const shouldDetach = persistent === true && !isDev;

        appLogger.info(
            'Proxy',
            `Spawning proxy: ${binaryPath} -config ${configPath} (detached: ${shouldDetach})`
        );

        this.child = spawn(
            binaryPath,
            [
                '-config',
                configPath,
                '-auth-api-port',
                authPort.toString(),
                '-auth-api-key',
                this.authApiKey,
            ],
            {
                cwd: path.dirname(binaryPath),
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                detached: shouldDetach,
            }
        );

        if (shouldDetach) {
            this.child.unref();
        }

        this.child.stdout?.on(
            'data',
            d => (this.stdoutBuffer = this.logProxyChunk(this.stdoutBuffer, d.toString(), 'info'))
        );
        this.child.stderr?.on(
            'data',
            d => (this.stderrBuffer = this.logProxyChunk(this.stderrBuffer, d.toString(), 'error'))
        );

        this.child.on('error', err => {
            appLogger.error('Proxy', `Failed to spawn proxy: ${err.message}`);
        });

        this.child.on('close', code => {
            appLogger.warn('Proxy', `Proxy process exited with code ${code}`);
            this.child = null;
            this.isProxyRunning = false;
        });

        appLogger.info('Proxy', `Proxy started with PID: ${this.child.pid}`);
    }

    async stop(force: boolean = false): Promise<ProxyEmbedStatus> {
        const start = performance.now();
        if (this.child) {
            appLogger.info('Proxy', `Stopping proxy (PID: ${this.child.pid})...`);
            this.child.kill();
            this.child = null;
        }

        if (force) {
            await this.killExistingProxyProcesses();
        }

        this.isProxyRunning = false;

        const elapsed = performance.now() - start;
        if (elapsed > PROXY_PROCESS_PERFORMANCE_BUDGETS.STOP_MS) {
            appLogger.warn('Proxy', `stop exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PROCESS_PERFORMANCE_BUDGETS.STOP_MS}ms`);
        }

        return this.getStatus();
    }

    private async killExistingProxyProcesses(): Promise<void> {
        const execAsync = promisify(exec);
        const proxyName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed';

        try {
            if (process.platform === 'win32') {
                appLogger.info('Proxy', `Killing existing ${proxyName} instances...`);
                // Use both taskkill by name AND force flag
                // We use cmd /c to ensure 2>nul works in all environments
                await execAsync(`cmd /c "taskkill /F /IM ${proxyName} /T 2>nul"`).catch(() => {
                    // Ignore errors - process may not exist
                });
            } else {
                await execAsync(`pkill -9 -f ${proxyName}`).catch(() => {
                    // Ignore errors
                });
            }
        } catch (e) {
            appLogger.debug(
                'Proxy',
                `Clean kill failed (expected if none running): ${getErrorMessage(e)}`
            );
        }
    }

    getStatus(): ProxyEmbedStatus {
        return {
            running: this.isProxyRunning || !!this.child,
            pid: this.child?.pid,
            port: this.currentPort,
        };
    }

    private getBinaryPath(): string {
        return getManagedRuntimeBinaryPath('cliproxy-embed');
    }

    private getSourceDir(): string {
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed');
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

        appLogger.info('Proxy', 'Rebuilding cliproxy-embed binary...');
        const outputFlag = process.platform === 'win32' ? '-o cliproxy-embed.exe' : '-o cliproxy-embed';
        const buildCmd = `go build ${outputFlag}`;
        const execAsync = promisify(exec);

        const env = {
            ...process.env,
            GOPATH: path.join(os.homedir(), 'go'),
            GOMODCACHE: path.join(os.homedir(), 'go', 'pkg', 'mod')
        };

        const { stdout, stderr } = await execAsync(buildCmd, { cwd: sourceDir, env });
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

        // Move/Copy binary from source dir to the managed runtime directory
        const builtBinary = path.join(sourceDir, path.basename(binaryPath));
        const builtExists = await fs.promises.access(builtBinary, fs.constants.F_OK).then(() => true).catch(() => false);
        if (builtExists) {
            await fs.promises.copyFile(builtBinary, binaryPath);
            appLogger.info('Proxy', `Binary built and copied to: ${binaryPath}`);
        }

        const finalExists = await fs.promises.access(binaryPath, fs.constants.F_OK).then(() => true).catch(() => false);
        if (!finalExists) {
            throw new Error('Failed to build embed binary');
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
                    results.push(...this.collectBuildInputs(fullPath));
                    continue;
                }
                if (entry.name.endsWith('.go') || entry.name === 'go.mod' || entry.name === 'go.sum') {
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
        const level = this.detectLogLevel(line, defaultLevel);

        if (level === 'error') {
            appLogger.error('Proxy', line.trim());
        } else if (level === 'warning') {
            appLogger.warn('Proxy', line.trim());
        } else {
            appLogger.info('Proxy', line.trim());
        }

        // IPC: Capture direct auth updates from Proxy (stdout)
        if (line.includes('__TENGRA_AUTH_UPDATE__:')) {
            const parts = line.split('__TENGRA_AUTH_UPDATE__:');
            if (parts.length > 1 && parts[1]) {
                const jsonContent = parts[1].trim();
                void this.handleAuthUpdateFromProxy(jsonContent);
                return; // Do not log the token to file
            }
        }
    }

    private detectLogLevel(
        line: string,
        defaultLevel: 'info' | 'error'
    ): 'info' | 'warning' | 'error' {
        if (/level=info|\[INFO\]/i.test(line)) {
            return 'info';
        }
        if (/level=warn(ing)?|\[WARN\]/i.test(line)) {
            return 'warning';
        }
        if (/level=error|\[ERROR\]|level=fatal/i.test(line)) {
            return 'error';
        }

        // Downgrade harmless stderr logs
        if (defaultLevel === 'error' && !/error|fatal/i.test(line)) {
            return 'info';
        }
        return defaultLevel;
    }

    /**
     * Generate a YAML config file for the cliproxy binary.
     * This is SEPARATE from settings.json to avoid corruption.
     */
    async generateProxyConfigFile(port: number): Promise<string> {
        const start = performance.now();
        const portError = validatePort(port);
        if (portError) {
            throw new Error(`Invalid proxy config port: ${portError}`);
        }

        const settings = this.settingsService.getSettings();
        const proxyKey = settings.proxy?.key ?? '';
        const authDir = this.dataService.getPath('auth');
        const authDirNormalized = authDir.replace(/\\/g, '/');
        await fs.promises.mkdir(authDir, { recursive: true });

        const yamlConfig = `host: "127.0.0.1"
port: ${port}
api-keys:
  - "${proxyKey}"
auth-dir: "${authDirNormalized}"
remote-management:
  secret-key: "${proxyKey}"
debug: false
logging-to-file: false
`;

        // Write to proxy-config.yaml (not settings.json)
        const configDir = this.dataService.getPath('config');
        const configPath = path.join(configDir, 'proxy-config.yaml');

        await fs.promises.writeFile(configPath, yamlConfig, 'utf8');
        appLogger.info('Proxy', `Generated proxy config at: ${configPath}`);

        // Update settings with just the basic proxy info (no YAML-specific fields)
        await this.settingsService.saveSettings({
            proxy: {
                enabled: settings.proxy?.enabled ?? false,
                url: settings.proxy?.url ?? `http://127.0.0.1:${port}/v1`,
                key: proxyKey,
                authStoreKey: settings.proxy?.authStoreKey,
            },
        });

        const elapsed = performance.now() - start;
        if (elapsed > PROXY_PROCESS_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS) {
            appLogger.warn('Proxy', `generateProxyConfigFile exceeded budget: ${elapsed.toFixed(1)}ms > ${PROXY_PROCESS_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS}ms`);
        }

        return configPath;
    }

    /**
     * @deprecated Use generateProxyConfigFile instead
     */
    async generateConfig(port: number) {
        // Kept for backwards compatibility - just calls the new method
        await this.generateProxyConfigFile(port);
    }

    private async handleAuthUpdateFromProxy(jsonString: string) {
        try {
            const data = safeJsonParse<JsonObject>(jsonString, {});
            const provider = (data.type as string) || 'unknown';

            appLogger.info('Proxy', `Received direct auth update for provider: ${provider}`);

            if (provider === 'unknown') {
                appLogger.warn('Proxy', 'Received auth update with unknown provider type');
                return;
            }

            const tokenData = this.constructTokenData(data);
            await this.authService.linkAccount(provider, tokenData);
            appLogger.info(
                'Proxy',
                `Successfully saved direct auth update to Database for ${provider}`
            );
        } catch (e) {
            appLogger.error('Proxy', `Failed to process direct auth update: ${e}`);
        }
    }

    private constructTokenData(data: JsonObject) {
        return {
            accessToken: this.getString(data, 'access_token', 'accessToken'),
            refreshToken: this.getString(data, 'refresh_token', 'refreshToken'),
            sessionToken: this.getString(data, 'session_token', 'sessionToken', 'session_key'),
            email: this.getString(data, 'email'),
            expiresAt: this.getNumber(data, 'expires_at', 'expiresAt'),
            scope: this.getString(data, 'scope'),
            metadata: data,
        };
    }

    private getString(obj: JsonObject, ...keys: string[]): string | undefined {
        for (const key of keys) {
            if (typeof obj[key] === 'string') {
                return obj[key] as string;
            }
        }
        return undefined;
    }

    private getNumber(obj: JsonObject, ...keys: string[]): number | undefined {
        for (const key of keys) {
            if (typeof obj[key] === 'number') {
                return obj[key] as number;
            }
        }
        return undefined;
    }
}

