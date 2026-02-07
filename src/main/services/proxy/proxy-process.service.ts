import { ChildProcess, exec, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
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
    private authApiKey: string = '';
    private isProxyRunning: boolean = false;

    constructor(
        private settingsService: SettingsService,
        private dataService: DataService,
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

        // Always kill any existing proxy processes on startup to ensure we use the latest binary
        await this.killExistingProxyProcesses();

        // Small delay to allow OS to release the port
        await new Promise(resolve => setTimeout(resolve, 500));

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

    async stop(force: boolean = false): Promise<ProxyEmbedStatus> {
        // Kill our managed child process if exists
        if (this.child) {
            this.child.kill();
            this.child = null;
        }

        // If force=true, also kill any orphaned/detached proxy processes
        if (force) {
            await this.killExistingProxyProcesses();
        }

        this.isProxyRunning = false;
        return this.getStatus();
    }

    /**
     * Kill any existing cliproxy-embed processes.
     * This ensures we always start with a fresh binary on app startup.
     */
    private async killExistingProxyProcesses(): Promise<void> {
        const execAsync = promisify(exec);
        const proxyName = process.platform === 'win32' ? 'cliproxy-embed.exe' : 'cliproxy-embed';

        try {
            if (process.platform === 'win32') {
                // Windows: Use taskkill to forcefully terminate all cliproxy-embed processes
                await execAsync(`taskkill /F /IM ${proxyName} 2>nul`).catch(() => {
                    // Ignore errors - process may not exist
                });
            } else {
                // Unix/Mac: Use pkill to terminate all cliproxy-embed processes
                await execAsync(`pkill -9 -f ${proxyName}`).catch(() => {
                    // Ignore errors - process may not exist
                });
            }
            appLogger.info('Proxy', 'Killed existing proxy processes');
        } catch {
            // Process not found is fine - ignore
            appLogger.debug('Proxy', 'No existing proxy processes to kill');
        }
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

}

