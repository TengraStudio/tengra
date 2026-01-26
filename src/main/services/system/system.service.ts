import { exec } from 'child_process';
import * as os from 'os';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { ISystemService } from '@main/types/services';
import { ServiceResponse, SystemInfo } from '@shared/types';
import { getErrorMessage } from '@shared/utils/error.util';

const execAsync = promisify(exec);

export class SystemService extends BaseService implements ISystemService {
    private systemInfo?: SystemInfo;

    constructor() {
        super('SystemService');
    }

    /**
     * Initialize the SystemService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing system service...');
        
        // Cache system info at startup
        try {
            this.systemInfo = await this.getSystemInfo();
            appLogger.info(this.name, `System info cached: ${this.systemInfo?.platform || 'unknown'} ${this.systemInfo?.release || 'unknown'}`);
        } catch (error) {
            appLogger.error(this.name, 'Failed to cache system info', error as Error);
        }
        
        appLogger.info(this.name, 'System service initialized');
    }

    /**
     * Cleanup the SystemService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up system service...');
        this.systemInfo = undefined;
        appLogger.info(this.name, 'System service cleaned up');
    }

    async setVolume(percent: number): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                await execAsync(`powershell -Command "$obj = new-object -com wscript.shell; foreach($i in 1..50) { $obj.SendKeys([char]174) }; foreach($i in 1..${Math.floor(percent / 2)}) { $obj.SendKeys([char]175) }"`);
            } else if (process.platform === 'linux') {
                await execAsync(`amixer sset 'Master' ${percent}%`);
            } else if (process.platform === 'darwin') {
                await execAsync(`osascript -e "set volume output volume ${percent}"`);
            }
            return { success: true, message: `Volume adjusted to approx ${percent}%` };
        } catch (e) {
            this.logError(`Failed to set volume to ${percent}%`, e);
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async setBrightness(percent: number): Promise<ServiceResponse<{ brightness: number }>> {
        try {
            if (process.platform === 'win32') {
                const cmd = `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${percent})"`;
                await execAsync(cmd);
            } else if (process.platform === 'linux') {
                // Requires xbacklight or similar
                await execAsync(`xbacklight -set ${percent}`);
            }
            return { success: true, result: { brightness: percent } };
        } catch (e) {
            this.logError(`Failed to set brightness to ${percent}%`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async getDiskSpace(): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e) {
            this.logError(`Failed to get disk space`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async getProcessOnPort(port: number): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port}`;
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e) {
            this.logError(`Failed to get process on port ${port}`, e);
            return { success: false, error: getErrorMessage(e as Error) || 'No process found on this port' };
        }
    }

    async setWallpaper(imagePath: string): Promise<ServiceResponse> {
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
                `;
                await execAsync(`powershell -Command "${code.replace(/\n/g, ' ')}"`);
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
        try {
            if (process.platform === 'win32') {
                const keyCode = keys[action];
                await execAsync(`powershell -Command "$obj = new-object -com wscript.shell; $obj.SendKeys([char]${keyCode})"`);
            }
            return { success: true, result: { action } };
        } catch (e) {
            this.logError(`Media control action ${action} failed`, e);
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    async launchApp(appName: string): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                const findCmd = `powershell -Command "Get-StartApps | Where-Object { $_.Name -like '*${appName}*' } | Select-Object -First 1 -ExpandProperty AppID"`;
                const { stdout } = await execAsync(findCmd);
                const appId = stdout.trim();
                if (appId) {
                    await execAsync(`powershell -Command "explorer.exe shell:appsFolder\\${appId}"`);
                    return { success: true, message: `Launched ${appName}` };
                }
                await execAsync(`start "" "${appName}"`);
            } else if (process.platform === 'linux') {
                await execAsync(`${appName} &`);
            }
            return { success: true, message: `Started ${appName}` };
        } catch (e) {
            this.logError(`Failed to launch app ${appName}`, e);
            return { success: false, error: `${getErrorMessage(e as Error)}: ${appName}` };
        }
    }

    async getSystemInfo(): Promise<SystemInfo> {
        return {
            platform: process.platform,
            arch: process.arch,
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            hostname: os.hostname(),
            release: os.release(),
            shell: process.env.SHELL ?? process.env.ComSpec
        };
    }

    async getProcessList(): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? 'tasklist' : 'ps aux';
            const { stdout } = await execAsync(cmd);
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
}
