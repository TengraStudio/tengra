import { net } from 'electron';
import { SettingsService } from './settings.service';

// Clients
const CLIENTS = {
    profile: {
        id: 'Ov23liBw1MLMHGdYxtUV', // Orbit AI
        scope: 'read:user user:email'
    },
    copilot: {
        id: '01ab8ac9400c4e429b23', // VS Code
        scope: 'read:user'
    }
}

// Device Flow Endpoints
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface DeviceCodeResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
    error?: string;
    error_description?: string;
}

export class AuthService {
    constructor(_settingsService: SettingsService) {
        // settingsService intentionally unused for now, keeping signature for future use
    }

    async requestDeviceCode(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
        return new Promise((resolve, reject) => {
            const client = CLIENTS[appId] || CLIENTS.profile
            const request = net.request({
                method: 'POST',
                url: DEVICE_CODE_URL,
            });
            request.setHeader('Accept', 'application/json');
            request.setHeader('Content-Type', 'application/json');

            const body = JSON.stringify({
                client_id: client.id,
                scope: client.scope
            });

            request.write(body);

            request.on('response', (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            request.end();
        });
    }

    async pollForToken(deviceCode: string, interval: number, appId: 'profile' | 'copilot' = 'profile'): Promise<string> {
        return new Promise((resolve, reject) => {
            const client = CLIENTS[appId] || CLIENTS.profile
            const checkToken = () => {
                const request = net.request({
                    method: 'POST',
                    url: ACCESS_TOKEN_URL,
                });
                request.setHeader('Accept', 'application/json');
                request.setHeader('Content-Type', 'application/json');

                const body = JSON.stringify({
                    client_id: client.id,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                });

                request.write(body);

                request.on('response', (response) => {
                    let data = '';
                    response.on('data', (chunk) => data += chunk);
                    response.on('end', () => {
                        try {
                            const json: TokenResponse = JSON.parse(data);
                            if (json.access_token) {
                                resolve(json.access_token);
                            } else if (json.error === 'authorization_pending') {
                                // Continue polling
                                setTimeout(checkToken, (interval + 1) * 1000);
                            } else if (json.error === 'slow_down') {
                                setTimeout(checkToken, (interval + 5) * 1000);
                            } else {
                                reject(new Error(json.error_description || json.error));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
                request.end();
            };

            // Initial waiting
            setTimeout(checkToken, interval * 1000);
        });
    }

    // Helper to start the flow
    async startLoginFlow(appId: 'profile' | 'copilot' = 'profile'): Promise<DeviceCodeResponse> {
        const codeData = await this.requestDeviceCode(appId);
        // URL is opened by renderer
        return codeData;
    }
}
