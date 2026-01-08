import { ISystemService } from '../types/services';
import { ServiceResponse } from '../../shared/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export class SystemService implements ISystemService {
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async setBrightness(percent: number): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                const cmd = `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${percent})"`;
                await execAsync(cmd);
            } else if (process.platform === 'linux') {
                // Requires xbacklight or similar
                await execAsync(`xbacklight -set ${percent}`);
            }
            return { success: true, result: { brightness: percent } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getDiskSpace(): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getProcessOnPort(port: number): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -i :${port}`;
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: 'No process found on this port' };
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
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async mediaControl(action: string): Promise<ServiceResponse> {
        const keys: any = {
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
        } catch (e: any) {
            return { success: false, error: e.message };
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
        } catch (e: any) {
            return { success: false, error: `Could not find or launch app: ${appName}` };
        }
    }

    async getSystemInfo(): Promise<any> {
        return {
            platform: process.platform,
            arch: process.arch,
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            hostname: os.hostname(),
            release: os.release(),
            shell: process.env.SHELL || process.env.ComSpec
        };
    }

    async getProcessList(): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? 'tasklist' : 'ps aux';
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async healthCheck(): Promise<ServiceResponse> {
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
