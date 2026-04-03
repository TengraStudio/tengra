import { spawn } from 'child_process';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { ISystemService } from '@main/types/services';
import { ServiceResponse, SystemInfo } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';

export class SystemService extends BaseService implements ISystemService {
    private systemInfo?: SystemInfo;

    constructor() {
        super('SystemService');
    }

    /**
     * Initialize the SystemService
     */
    async initialize(): Promise<void> {
        appLogger.debug(this.name, 'Initializing system service...');

        // Cache system info at startup
        try {
            this.systemInfo = await this.getSystemInfo();
            appLogger.info(this.name, `System info cached: ${this.systemInfo.platform || 'unknown'} ${this.systemInfo.release || 'unknown'}`);
        } catch (error) {
            appLogger.error(this.name, 'Failed to cache system info', error as Error);
        }

        appLogger.debug(this.name, 'System service initialized');
    }

    /**
     * Cleanup the SystemService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up system service...');
        this.systemInfo = undefined;
        appLogger.info(this.name, 'System service cleaned up');
    }

    /**
     * Internal helper for safe process execution via spawn
     */
    private async runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; status: number | null }> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { shell: false });
            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => { stdout += data.toString(); });
            child.stderr?.on('data', (data) => { stderr += data.toString(); });

            child.on('error', (err) => {
                reject(err);
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, status: code });
            });
        });
    }

    async setVolume(percent: number): Promise<ServiceResponse> {
        // Validate input range
        const vol = Math.max(0, Math.min(100, percent));
        try {
            if (process.platform === 'win32') {
                const keys = Math.floor(vol / 2);
                const script = `$obj = new-object -com wscript.shell; foreach($i in 1..50) { $obj.SendKeys([char]174) }; foreach($i in 1..${keys}) { $obj.SendKeys([char]175) }`;
                await this.runCommand('powershell', ['-Command', script]);
            } else if (process.platform === 'linux') {
                await this.runCommand('amixer', ['sset', 'Master', `${vol}%`]);
            } else if (process.platform === 'darwin') {
                await this.runCommand('osascript', ['-e', `set volume output volume ${vol}`]);
            }
            return { success: true, message: `Volume adjusted to approx ${vol}%` };
        } catch (e) {
            this.logError(`Failed to set volume to ${vol}%`, e);
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async setBrightness(percent: number): Promise<ServiceResponse<{ brightness: number }>> {
        const bright = Math.max(0, Math.min(100, percent));
        try {
            if (process.platform === 'win32') {
                const script = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${bright})`;
                await this.runCommand('powershell', ['-Command', script]);
            } else if (process.platform === 'linux') {
                await this.runCommand('xbacklight', ['-set', `${bright}`]);
            }
            return { success: true, result: { brightness: bright } };
        } catch (e) {
            this.logError(`Failed to set brightness to ${bright}%`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async getDiskSpace(): Promise<ServiceResponse<{ output: string }>> {
        try {
            let result;
            if (process.platform === 'win32') {
                result = await this.runCommand('wmic', ['logicaldisk', 'get', 'size,freespace,caption']);
            } else {
                result = await this.runCommand('df', ['-h']);
            }
            return { success: true, result: { output: result.stdout } };
        } catch (e) {
            this.logError(`Failed to get disk space`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async getProcessOnPort(port: number): Promise<ServiceResponse<{ output: string }>> {
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            return { success: false, error: 'Invalid port number' };
        }
        try {
            let result;
            if (process.platform === 'win32') {
                // netstat doesn't support direct port filtering well without findstr, but we can't use pipes with shell:false easily
                // We'll use powershell for better filtering without pipes
                const script = `Get-NetTCPConnection -LocalPort ${port} | Select-Object -Property OwningProcess, State | Format-Table -HideTableHeaders`;
                result = await this.runCommand('powershell', ['-Command', script]);
            } else {
                result = await this.runCommand('lsof', ['-i', `:${port}`]);
            }
            return { success: true, result: { output: result.stdout } };
        } catch (e) {
            this.logError(`Failed to get process on port ${port}`, e);
            return { success: false, error: getErrorMessage(e as Error) || 'No process found on this port' };
        }
    }

    async setWallpaper(imagePath: string): Promise<ServiceResponse> {
        // Basic path validation - prevent some obvious injection attempts
        if (imagePath.includes('"') || imagePath.includes(';') || imagePath.includes('$')) {
            return { success: false, error: 'Invalid image path' };
        }
        try {
            if (process.platform === 'win32') {
                const code = `
$code = @'
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
'@
Add-Type -TypeDefinition $code
[Win32]::SystemParametersInfo(0x0014, 0, "${imagePath}", 0x01 -bor 0x02)
`.replace(/\n/g, ' ');
                await this.runCommand('powershell', ['-Command', code]);
            }
            return { success: true, message: 'Wallpaper changed' };
        } catch (e) {
            this.logError(`Failed to set wallpaper to ${imagePath}`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async mediaControl(action: string): Promise<ServiceResponse<{ action: string }>> {
        const keys: Record<string, number> = {
            'playpause': 179,
            'next': 176,
            'prev': 177,
            'stop': 178
        };
        const keyCode = keys[action];
        if (!keyCode) {
            return { success: false, error: 'Invalid media action' };
        }
        try {
            if (process.platform === 'win32') {
                const script = `$obj = new-object -com wscript.shell; $obj.SendKeys([char]${keyCode})`;
                await this.runCommand('powershell', ['-Command', script]);
            }
            return { success: true, result: { action } };
        } catch (e) {
            this.logError(`Media control action ${action} failed`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    private isValidAppName(name: string): boolean {
        // App names should be alphanumeric with spaces and some basic symbols
        return /^[a-zA-Z0-9\s\-_.]+$/.test(name);
    }

    async launchApp(appName: string): Promise<ServiceResponse> {
        if (!this.isValidAppName(appName)) {
            return { success: false, error: 'Invalid app name' };
        }
        try {
            if (process.platform === 'win32') {
                const script = `Get-StartApps | Where-Object { $_.Name -like "*${appName}*" } | Select-Object -First 1 -ExpandProperty AppID`;
                const { stdout } = await this.runCommand('powershell', ['-Command', script]);
                const appId = stdout.trim();
                if (appId) {
                    // shell:appsFolder\... is handled by explorer.exe
                    await this.runCommand('explorer.exe', [`shell:appsFolder\\${appId}`]);
                    return { success: true, message: `Launched ${appName}` };
                }
                // Fallback to start command for general executables/files
                // 'start' is a shell builtin, but explorer.exe can also handle generic paths safely
                await this.runCommand('explorer.exe', [appName]);
            } else if (process.platform === 'linux') {
                // On linux, we just try to run it. No shell needed for simple app launch.
                spawn(appName, [], { detached: true, stdio: 'ignore' }).unref();
            }
            return { success: true, message: `Started ${appName}` };
        } catch (e) {
            this.logError(`Failed to launch app ${appName}`, e);
            return { success: false, error: `${getErrorMessage(e as Error)}: ${appName}` };
        }
    }

    async getSystemInfo(): Promise<SystemInfo> {
        const envUsername = process.env.USERNAME?.trim();
        const envUserProfile = process.env.USERPROFILE?.trim();
        const profileSegment = envUserProfile
            ? envUserProfile.split(/[\\/]/).filter(Boolean).pop()
            : undefined;
        const osUsername = os.userInfo().username?.trim();
        const resolvedUsername = envUsername || profileSegment || osUsername || 'unknown';
        return {
            platform: process.platform,
            arch: process.arch,
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            hostname: os.hostname(),
            release: os.release(),
            shell: process.env.SHELL ?? process.env.ComSpec,
            homeDir: os.homedir(),
            username: resolvedUsername,
            cwd: process.cwd(),
            tempDir: os.tmpdir()
        };
    }

    async getProcessList(): Promise<ServiceResponse<{ output: string }>> {
        try {
            const command = process.platform === 'win32' ? 'tasklist' : 'ps';
            const args = process.platform === 'win32' ? [] : ['aux'];
            const { stdout } = await this.runCommand(command, args);
            return { success: true, result: { output: stdout } };
        } catch (e) {
            this.logError(`Failed to get process list`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async healthCheck(): Promise<ServiceResponse<{ status: string; timestamp: number; memory: NodeJS.MemoryUsage; uptime: number; platform: NodeJS.Platform }>> {
        return {
            success: true,
            result: {
                status: 'healthy',
                timestamp: Date.now(),
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                platform: process.platform
            }
        };
    }

    async getUsage(): Promise<ServiceResponse<{ cpu: number; memory: number }>> {
        try {
            const cpuUsage = os.loadavg()[0];
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memUsage = totalMem > 0 ? ((totalMem - freeMem) / totalMem) * 100 : 0;

            return {
                success: true,
                result: { cpu: cpuUsage, memory: memUsage }
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async getSystemMonitor(): Promise<ServiceResponse<{ output: string }>> {
        try {
            let output = '';
            if (process.platform === 'win32') {
                const res = await this.runCommand('wmic', ['cpu', 'get', 'loadpercentage', '/value']);
                output = res.stdout;
            } else if (process.platform === 'linux' || process.platform === 'darwin') {
                const res = await this.runCommand('top', ['-l', '1', '-n', '0']);
                output = res.stdout;
            }
            return { success: true, result: { output } };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    async getBatteryStatus(): Promise<ServiceResponse<{ output: string }>> {
        try {
            let output = '';
            if (process.platform === 'win32') {
                const res = await this.runCommand('powershell', ['-Command', 'Get-CimInstance -ClassName Win32_Battery | Select-Object -Property EstimatedChargeRemaining, BatteryStatus']);
                output = res.stdout;
            } else if (process.platform === 'darwin') {
                const res = await this.runCommand('pmset', ['-g', 'batt']);
                output = res.stdout;
            }
            return { success: true, result: { output } };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }
}
