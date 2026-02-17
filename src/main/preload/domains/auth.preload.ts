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
    ) => Promise<{ success: boolean; token?: string; error?: string }>;
    antigravityLogin: () => Promise<{ url: string; state: string }>;
    saveClaudeSession: (sessionKey: string, accountId?: string) => Promise<{ success: boolean; error?: string }>;
}

export function createAuthBridge(ipc: IpcRenderer): AuthBridge {
    return {
        githubLogin: (appId?: 'profile' | 'copilot') => ipc.invoke('auth:github-login', appId),
        pollToken: (deviceCode: string, interval: number, appId?: 'profile' | 'copilot') =>
            ipc.invoke('auth:poll-token', deviceCode, interval, appId),
        antigravityLogin: () => ipc.invoke('proxy:antigravityLogin'),
        saveClaudeSession: (sessionKey: string, accountId?: string) =>
            ipc.invoke('proxy:saveClaudeSession', sessionKey, accountId),
    };
}
