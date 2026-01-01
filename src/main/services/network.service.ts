import { INetworkService } from '../types/services';
import { ServiceResponse } from '../../shared/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import * as os from 'os';

const execAsync = promisify(exec);

export class NetworkService implements INetworkService {
    async ping(host: string): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async whois(domain: string): Promise<ServiceResponse<{ output: string }>> {
        try {
            const { stdout } = await execAsync(`whois ${domain}`);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: 'WHOIS command failed. Is it installed?' };
        }
    }

    async scanPort(host: string, port: number, timeout: number = 200): Promise<ServiceResponse<{ port: number; status: string }>> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);
            socket.on('connect', () => {
                socket.destroy();
                resolve({ success: true, result: { port, status: 'open' } });
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve({ success: true, result: { port, status: 'closed (timeout)' } });
            });
            socket.on('error', () => {
                socket.destroy();
                resolve({ success: true, result: { port, status: 'closed' } });
            });
            socket.connect(port, host);
        });
    }

    async traceroute(host: string): Promise<ServiceResponse<{ output: string }>> {
        try {
            const cmd = process.platform === 'win32' ? `tracert ${host}` : `traceroute ${host}`;
            const { stdout } = await execAsync(cmd);
            return { success: true, result: { output: stdout } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    startWebSocketServer(port: number = 8080): ServiceResponse {
        try {
            const WebSocket = require('ws');
            const wsServer = new WebSocket.Server({ port });
            wsServer.on('connection', (ws: any) => {
                console.log('[WS] Connected');
                ws.on('message', (message: string) => {
                    console.log('[WS] Received:', message);
                });
            });
            return { success: true, message: `WebSocket server started on port ${port}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
    async getNetworkInterfaces(): Promise<ServiceResponse<any>> {
        try {
            const interfaces = os.networkInterfaces();
            return { success: true, result: interfaces };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getPublicIP(): Promise<ServiceResponse<{ ip: string }>> {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return { success: true, result: { ip: data.ip } };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
