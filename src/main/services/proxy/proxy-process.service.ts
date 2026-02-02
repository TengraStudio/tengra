import { ChildProcess, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { SecurityService } from '@main/services/security/security.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';


export interface ProxyEmbedStatus {
    running: boolean
    pid?: number
    port?: number
    configPath?: string
    binaryPath?: string
    error?: string
}


export class ProxyProcessManager {
    private child: ChildProcess | null = null;
    private currentPort: number = 8317;
    private stdoutBuffer = '';
    private stderrBuffer = '';
    private startupTime: number = Date.now();
    private authApiKey: string = '';
    private isProxyRunning: boolean = false;

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
        private securityService: SecurityService,
        private authService: AuthService,
        private authAPIService: AuthAPIService
    ) { }

    async start(options?: { port?: number; persistent?: boolean }): Promise<ProxyEmbedStatus> {
        if (this.child) {
            return this.getStatus();
        }

        const binaryPath = this.getBinaryPath();
        appLogger.info('Proxy', `Binary path: ${binaryPath}`);

        if (!(await this.verifyBinaryExists(binaryPath))) {
            return { running: false, error: `Binary not found at ${binaryPath}` };
        }

        this.currentPort = options?.port ?? 8317;

        // Check if port is already in use (e.g., from a previous detached proxy instance)
        const portStatus = await this.ensurePortAvailability(this.currentPort);
        if (portStatus.running) {
            this.isProxyRunning = true;
            return { running: true, port: this.currentPort };
        }
        if (portStatus.error) {
            appLogger.error('Proxy', `Port ${this.currentPort} still in use, cannot start proxy`);
            return { running: false, port: this.currentPort, error: portStatus.error };
        }

        // Get the auth API port to pass to the proxy
        const authAPIPort = this.setupAuthAPI();
        if (authAPIPort === 0) {
            appLogger.error('Proxy', 'AuthAPIService not initialized - port is 0');
            return { running: false, error: 'AuthAPIService not initialized' };
        }
        appLogger.info('Proxy', `Using HTTP auth API on port ${authAPIPort}`);

        // Generate YAML config for the proxy binary (separate from settings.json)
        const proxyConfigPath = await this.generateProxyConfigFile(this.currentPort);

        this.spawnProxyProcess(binaryPath, proxyConfigPath, authAPIPort, options?.persistent);

        this.isProxyRunning = true;
        return this.getStatus();
    }

    private async verifyBinaryExists(binaryPath: string): Promise<boolean> {
        try {
            await fs.promises.access(binaryPath);
            return true;
        } catch {
            appLogger.error('Proxy', `Binary not found at: ${binaryPath}`);
            return false;
        }
    }

    private setupAuthAPI(): number {
        const authAPIPort = this.authAPIService.getPort();
        if (authAPIPort === 0) { return 0; }

        // Generate and set API key for the Auth API
        this.authApiKey = crypto.randomBytes(32).toString('hex');
        const authApi = this.authAPIService as { setApiKey?: (key: string) => void };
        if (authApi.setApiKey) {
            authApi.setApiKey(this.authApiKey);
        }
        return authAPIPort;
    }

    private spawnProxyProcess(binaryPath: string, configPath: string, authPort: number, persistent?: boolean) {
        this.child = spawn(binaryPath, [
            '-config', configPath,
            '-auth-api-port', authPort.toString(),
            '-auth-api-key', this.authApiKey
        ], {
            cwd: path.dirname(binaryPath),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            detached: true // Allow it to live beyond Tandem
        });

        this.child.unref(); // Electron won't wait for it

        this.child.stdout?.on('data', d => this.stdoutBuffer = this.logProxyChunk(this.stdoutBuffer, d.toString(), 'info'));
        this.child.stderr?.on('data', d => this.stderrBuffer = this.logProxyChunk(this.stderrBuffer, d.toString(), 'error'));
        this.child.on('close', code => {
            this.child = null;
            appLogger.warn('Proxy', `Proxy exited: ${code}`);
        });

        appLogger.info('Proxy', `Proxy started with PID: ${this.child.pid}`);

        if (persistent) {
            appLogger.info('Proxy', 'Proxy started in persistent mode (detached)');
        }
    }

    async stop(_force: boolean = false): Promise<ProxyEmbedStatus> {
        if (this.child) {
            // If the user manually stops it (force=true) or if it's NOT persistent logic (handled by caller passing force=true?)
            // Actually, if we want lifecycle management:
            // - App Exit: call stop(false) -> if persistent, don't kill.
            // - Manual Reset: call stop(true) -> kill.

            // However, existing calls to stop() don't pass args.
            // We'll rely on the caller logic. If this method is called, we assume we want to stop it.
            // BUT, for app shutdown, we should avoid calling stop() if we want it to persist.
            // Logic must be upstream in ProxyService.

            // For now, just implement kill.
            this.child.kill();
            this.child = null;
        }
        this.isProxyRunning = false;

        return this.getStatus();
    }



    getStatus(): ProxyEmbedStatus {
        return { running: this.isProxyRunning || !!this.child, pid: this.child?.pid, port: this.currentPort };
    }

    private getBinaryPath(): string {
        const binName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed';
        return path.join(process.cwd(), 'vendor', 'cliproxyapi', 'cmd', 'cliproxy-embed', binName);
    }

    private logProxyChunk(currentBuffer: string, chunk: string, defaultLevel: 'info' | 'error'): string {
        const buffer = currentBuffer + chunk;
        const lines = buffer.split(/\r?\n/);
        const remainder = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim()) { continue; }
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
        if (line.includes('__TANDEM_AUTH_UPDATE__:')) {
            const parts = line.split('__TANDEM_AUTH_UPDATE__:');
            if (parts.length > 1 && parts[1]) {
                const jsonContent = parts[1].trim();
                void this.handleAuthUpdateFromProxy(jsonContent);
                return; // Do not log the token to file
            }
        }
    }

    private detectLogLevel(line: string, defaultLevel: 'info' | 'error'): 'info' | 'warning' | 'error' {
        if (/level=info|\[INFO\]/i.test(line)) { return 'info'; }
        if (/level=warn(ing)?|\[WARN\]/i.test(line)) { return 'warning'; }
        if (/level=error|\[ERROR\]|level=fatal/i.test(line)) { return 'error'; }

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
        const settings = this.settingsService.getSettings();
        const proxyKey = settings.proxy?.key ?? '';

        const yamlConfig = `host: "127.0.0.1"
port: ${port}
api-keys:
  - "${proxyKey}"
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
                authStoreKey: settings.proxy?.authStoreKey
            }
        });

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
            appLogger.info('Proxy', `Successfully saved direct auth update to Database for ${provider}`);
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
            metadata: data
        };
    }

    private getString(obj: JsonObject, ...keys: string[]): string | undefined {
        for (const key of keys) {
            if (typeof obj[key] === 'string') { return obj[key] as string; }
        }
        return undefined;
    }

    private getNumber(obj: JsonObject, ...keys: string[]): number | undefined {
        for (const key of keys) {
            if (typeof obj[key] === 'number') { return obj[key] as number; }
        }
        return undefined;
    }

    private async ensurePortAvailability(port: number): Promise<{ running?: boolean; error?: string }> {
        const portInUse = await this.isPortInUse(port);
        if (!portInUse) { return {}; }

        appLogger.info('Proxy', `Port ${port} already in use, checking if it's our proxy...`);
        const isOurProxy = await this.verifyExistingProxy(port);
        if (isOurProxy) {
            appLogger.info('Proxy', `Existing proxy detected on port ${port}, reusing it`);
            return { running: true };
        }

        appLogger.warn('Proxy', `Port ${port} in use by unknown process, attempting to find alternative or waiting...`);
        // Wait a bit and retry - the old proxy might be shutting down
        await new Promise(resolve => setTimeout(resolve, 1000));
        const stillInUse = await this.isPortInUse(port);
        if (stillInUse) {
            return { error: `Port ${port} is already in use` };
        }
        return {};
    }

    /**
     * Check if a port is already in use
     */
    private async isPortInUse(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.once('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(false);
            });

            server.listen(port, '127.0.0.1');
        });
    }

    /**
     * Verify if an existing process on the port is our proxy
     * by making a simple health check request
     */
    private async verifyExistingProxy(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const settings = this.settingsService.getSettings();
            const key = settings.proxy?.key ?? '';

            const req = http.request({
                hostname: '127.0.0.1',
                port,
                path: '/v1/models',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`
                },
                timeout: 2000
            }, (res) => {
                // Only reuse if we are authorized (Key matches)
                if (res.statusCode === 401 || res.statusCode === 403) {
                    appLogger.warn('Proxy', `Found existing proxy on port ${port} but key rejected (HTTP ${res.statusCode}). Not reusing.`);
                    resolve(false);
                } else {
                    resolve(res.statusCode !== undefined && res.statusCode < 500);
                }
            });

            req.on('error', () => {
                resolve(false);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }
}

