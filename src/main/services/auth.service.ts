import { net, shell } from 'electron';
import { SettingsService } from './settings.service';

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // VS Code's Client ID (commonly used for Copilot integrations)
const GITHUB_SCOPE = 'read:user'; // Copilot needs minimal scope initially, then specific flows

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
    private settingsService: SettingsService;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(settingsService: SettingsService) {
        this.settingsService = settingsService;
    }

    async requestDeviceCode(): Promise<DeviceCodeResponse> {
        return new Promise((resolve, reject) => {
            const request = net.request({
                method: 'POST',
                url: DEVICE_CODE_URL,
            });
            request.setHeader('Accept', 'application/json');
            request.setHeader('Content-Type', 'application/json');

            const body = JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: GITHUB_SCOPE
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

    async pollForToken(deviceCode: string, interval: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const checkToken = () => {
                const request = net.request({
                    method: 'POST',
                    url: ACCESS_TOKEN_URL,
                });
                request.setHeader('Accept', 'application/json');
                request.setHeader('Content-Type', 'application/json');

                const body = JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
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
    async startLoginFlow(): Promise<DeviceCodeResponse> {
        const codeData = await this.requestDeviceCode();
        shell.openExternal(codeData.verification_uri);
        return codeData;
    }
}
