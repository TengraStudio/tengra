import { IpcRenderer } from 'electron';

export interface AuthBridge {
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
    ) => Promise<{
        success: boolean;
        account?: {
            provider: string;
            email?: string;
            displayName?: string;
            avatarUrl?: string;
        };
        error?: string;
    }>;
}

export function createAuthBridge(ipc: IpcRenderer): AuthBridge {
    return {
        githubLogin: (appId?: 'profile' | 'copilot') => ipc.invoke('auth:github-login', appId),
        pollToken: (deviceCode: string, interval: number, appId?: 'profile' | 'copilot') =>
            ipc.invoke('auth:poll-token', deviceCode, interval, appId),
    };
}
