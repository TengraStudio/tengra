import { ServiceResponse } from '../../shared/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export class MonitoringService {
    async getUsage(): Promise<ServiceResponse<{ cpu: number; memory: number }>> {
        const cpuUsage = os.loadavg()[0]; // 1 minute average
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memUsage = ((totalMem - freeMem) / totalMem) * 100;

        return {
            success: true,
            result: {
                cpu: cpuUsage,
                memory: memUsage
            }
        };
    }

    async getSystemMonitor(): Promise<ServiceResponse> {
        try {
            let output = "";
            if (process.platform === 'win32') {
                const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
                output = stdout;
            } else {
                const { stdout } = await execAsync('top -bn1 | grep "Cpu(s)"');
                output = stdout;
            }
            return { success: true, result: { output } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getBatteryStatus(): Promise<ServiceResponse> {
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execAsync('powershell -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object -Property EstimatedChargeRemaining, BatteryStatus"');
                return { success: true, result: { output: stdout } };
            } else if (process.platform === 'linux') {
                const { stdout } = await execAsync('upower -i $(upower -e | grep battery)');
                return { success: true, result: { output: stdout } };
            }
            return { success: false, error: 'Battery status not supported on this platform' };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
