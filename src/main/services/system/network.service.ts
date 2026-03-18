import { spawn } from 'child_process';
import * as net from 'net';
import * as os from 'os';

import { appLogger } from '@main/logging/logger';
import { INetworkService } from '@main/types/services';
import { ServiceResponse } from '@shared/types';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { WebSocketServer } from 'ws';

const NETWORK_MESSAGE_KEY = {
    INVALID_HOSTNAME_OR_IP: 'mainProcess.networkService.invalidHostnameOrIp',
    INVALID_DOMAIN_NAME: 'mainProcess.networkService.invalidDomainName',
    WHOIS_COMMAND_FAILED: 'mainProcess.networkService.whoisCommandFailed',
    INVALID_HOST: 'mainProcess.networkService.invalidHost',
    WEBSOCKET_STARTED: 'mainProcess.networkService.websocketStarted'
} as const;
const NETWORK_ERROR_MESSAGE = {
    INVALID_HOSTNAME_OR_IP: 'Invalid hostname or IP address',
    INVALID_DOMAIN_NAME: 'Invalid domain name',
    WHOIS_COMMAND_FAILED: 'WHOIS command failed. Is it installed?',
    INVALID_HOST: 'Invalid host',
    WEBSOCKET_STARTED: 'WebSocket server started on port {{port}}'
} as const;

export class NetworkService implements INetworkService {
    private readonly wssInstances: WebSocketServer[] = [];

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

    private isValidHost(host: string): boolean {
        // Basic hostname/IP validation regex
        return /^[a-zA-Z0-9][-a-zA-Z0-9.]+[a-zA-Z0-9]$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    }

    async ping(host: string): Promise<ServiceResponse<{ output: string }>> {
        if (!this.isValidHost(host)) {
            return {
                success: false,
                error: NETWORK_ERROR_MESSAGE.INVALID_HOSTNAME_OR_IP,
                messageKey: NETWORK_MESSAGE_KEY.INVALID_HOSTNAME_OR_IP
            };
        }
        try {
            const args = process.platform === 'win32' ? ['-n', '4', host] : ['-c', '4', host];
            const { stdout } = await this.runCommand('ping', args);
            return { success: true, result: { output: stdout } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async whois(domain: string): Promise<ServiceResponse<{ output: string }>> {
        if (!this.isValidHost(domain)) {
            return {
                success: false,
                error: NETWORK_ERROR_MESSAGE.INVALID_DOMAIN_NAME,
                messageKey: NETWORK_MESSAGE_KEY.INVALID_DOMAIN_NAME
            };
        }
        try {
            const { stdout } = await this.runCommand('whois', [domain]);
            return { success: true, result: { output: stdout } };
        } catch {
            return {
                success: false,
                error: NETWORK_ERROR_MESSAGE.WHOIS_COMMAND_FAILED,
                messageKey: NETWORK_MESSAGE_KEY.WHOIS_COMMAND_FAILED
            };
        }
    }

    async scanPort(
        host: string,
        port: number,
        timeout: number = 2000
    ): Promise<ServiceResponse<{ port: number; status: string }>> {
        if (!this.isValidHost(host)) {
            return {
                success: false,
                error: NETWORK_ERROR_MESSAGE.INVALID_HOST,
                messageKey: NETWORK_MESSAGE_KEY.INVALID_HOST
            };
        }
        return new Promise(resolve => {
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
        if (!this.isValidHost(host)) {
            return {
                success: false,
                error: NETWORK_ERROR_MESSAGE.INVALID_HOSTNAME_OR_IP,
                messageKey: NETWORK_MESSAGE_KEY.INVALID_HOSTNAME_OR_IP
            };
        }
        try {
            const command = process.platform === 'win32' ? 'tracert' : 'traceroute';
            const { stdout } = await this.runCommand(command, [host]);
            return { success: true, result: { output: stdout } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    startWebSocketServer(port: number = 8080): ServiceResponse {
        try {
            const wsServer = new WebSocketServer({ port });
            wsServer.on('connection', ws => {
                appLogger.info('network.service', '[WS] Connected');
                ws.on('message', (message: string) => {
                    appLogger.info('network.service', '[WS] Received:', message);
                });
            });
            this.wssInstances.push(wsServer);
            return {
                success: true,
                message: NETWORK_ERROR_MESSAGE.WEBSOCKET_STARTED.replace('{{port}}', String(port)),
                messageKey: NETWORK_MESSAGE_KEY.WEBSOCKET_STARTED,
                messageParams: { port }
            };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    /**
     * Terminates all connected clients and closes every tracked WebSocket server.
     */
    public cleanup(): void {
        for (const wss of this.wssInstances) {
            for (const client of wss.clients) {
                client.terminate();
            }
            wss.close();
        }
        this.wssInstances.length = 0;
    }
    async getNetworkInterfaces(): Promise<ServiceResponse<JsonObject>> {
        try {
            const interfaces = os.networkInterfaces();
            return { success: true, result: interfaces as JsonObject };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    async getPublicIP(): Promise<ServiceResponse<{ ip: string }>> {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = (await response.json()) as { ip: string };
            return { success: true, result: { ip: data.ip } };
        } catch (e) {
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }
}
