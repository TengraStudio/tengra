import { randomUUID } from 'crypto';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { sshConnectionSchema, sshProfileSchema, validateIpc } from '@main/ipc/validation';
import { SSHConnection, SSHService } from '@main/services/project/ssh.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { IpcValue, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

function sanitizeConnectionForRenderer(connection: SSHConnection): Omit<SSHConnection, 'password' | 'privateKey' | 'passphrase'> {
    const safeConnection = { ...connection };
    delete safeConnection.password;
    delete safeConnection.privateKey;
    delete safeConnection.passphrase;
    return safeConnection;
}

export function registerSshIpc(getMainWindow: () => BrowserWindow | null, sshService: SSHService, rateLimitService: RateLimitService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'ssh operation');
    const secureHandle = <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => {
        ipcMain.handle(channel, async (event, ...args: Args) => {
            validateSender(event);
            return await handler(event, ...args);
        });
    };
    const send = (channel: string, data: JsonValue) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    };

    // Store listener references for cleanup
    const listeners = {
        stdout: (payload: JsonValue) => send('ssh:stdout', payload),
        stderr: (payload: JsonValue) => send('ssh:stderr', payload),
        connected: (id: string) => send('ssh:connected', id),
        disconnected: (id: string) => send('ssh:disconnected', id),
        error: (payload: JsonValue) => send('ssh:error', payload)
    };

    sshService.on('stdout', listeners.stdout);
    sshService.on('stderr', listeners.stderr);
    sshService.on('connected', listeners.connected);
    sshService.on('disconnected', listeners.disconnected);
    sshService.on('error', listeners.error);

    registerConnectionHandlers(sshService, secureHandle);
    registerCommandHandlers(sshService, rateLimitService, send, secureHandle);
    registerFileSystemHandlers(sshService, send, secureHandle);
    registerSystemHandlers(sshService, secureHandle);

    // Return dispose function
    return () => {
        sshService.off('stdout', listeners.stdout);
        sshService.off('stderr', listeners.stderr);
        sshService.off('connected', listeners.connected);
        sshService.off('disconnected', listeners.disconnected);
        sshService.off('error', listeners.error);
    };
}

function registerConnectionHandlers(
    sshService: SSHService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:connect', async (_event, connection: unknown) => {
        const validated = validateIpc(sshConnectionSchema, connection, 'ssh:connect');

        const id = validated.id ?? randomUUID();
        const authType = validated.authType ?? (validated.privateKey ? 'key' : 'password');

        const payload: SSHConnection = {
            id,
            name: validated.name ?? `${validated.username}@${validated.host}`,
            host: validated.host,
            port: validated.port,
            username: validated.username,
            authType,
            password: validated.password,
            privateKey: validated.privateKey,
            passphrase: validated.passphrase,
            connected: false,
            // Pass through optional fields
            jumpHost: validated.jumpHost,
            forwardAgent: validated.forwardAgent,
            keepaliveInterval: validated.keepaliveInterval
        };

        const result = await sshService.connect(payload);
        return { ...result, id };
    });

    secureHandle('ssh:disconnect', async (_event, connectionId: string) => {
        try {
            await sshService.disconnect(connectionId);
            return { success: true };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:getConnections', async () => {
        return sshService.getAllConnections().map(sanitizeConnectionForRenderer);
    });

    secureHandle('ssh:isConnected', async (_event, connectionId: string) => {
        return sshService.isConnected(connectionId);
    });

    secureHandle('ssh:getProfiles', async () => {
        const profiles = await sshService.getSavedProfiles();
        return profiles.map(sanitizeConnectionForRenderer);
    });

    secureHandle('ssh:saveProfile', async (_event, profile: unknown) => {
        try {
            const validated = validateIpc(sshProfileSchema, profile, 'ssh:saveProfile');
            // Validation strips unknown fields but SSHConnection has index signature [key: string]
            // We cast back to SSHConnection including any extra fields if we want, or stick to schema
            // For safety, let's stick to validated + explicit cast if needed or allow pass-through if schema permits.
            // Our schema doesn't have .passthrough() so unknown keys are stripped. 
            // This is safer.
            return await sshService.saveProfile(validated as SSHConnection);
        } catch {
            return false;
        }
    });

    secureHandle('ssh:deleteProfile', async (_event, id: string) => {
        try {
            return await sshService.deleteProfile(id);
        } catch {
            return false;
        }
    });
}

function registerCommandHandlers(
    sshService: SSHService,
    rateLimitService: RateLimitService,
    send: (channel: string, data: JsonValue) => void,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:execute', async (_event, connectionId: string, command: string, options?: Record<string, IpcValue>) => {
        try {
            await rateLimitService.waitForToken('ssh:execute');
            return await sshService.executeCommand(connectionId, command, options);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, stdout: '', stderr: message, code: 1 };
        }
    });

    secureHandle('ssh:shellStart', async (_event, connectionId: string) => {
        return await sshService.startShell(
            connectionId,
            (data) => send('ssh:shellData', { connectionId, data }),
            () => send('ssh:disconnected', connectionId)
        );
    });

    secureHandle('ssh:shellWrite', async (_event, payload: { connectionId: string; data: string }) => {
        const success = sshService.sendShellData(payload.connectionId, payload.data);
        return { success };
    });
}

function registerFileSystemHandlers(
    sshService: SSHService,
    send: (channel: string, data: JsonValue) => void,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:listDir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            return await sshService.listDirectory(payload.connectionId, payload.path);
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:readFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const content = await sshService.readFile(payload.connectionId, payload.path);
            return { success: true, content };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:writeFile', async (_event, payload: { connectionId: string; path: string; content: string }) => {
        try {
            const success = await sshService.writeFile(payload.connectionId, payload.path, payload.content);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:deleteDir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.deleteDirectory(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:deleteFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.deleteFile(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:mkdir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.createDirectory(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:rename', async (_event, payload: { connectionId: string; oldPath: string; newPath: string }) => {
        try {
            const success = await sshService.rename(payload.connectionId, payload.oldPath, payload.newPath);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:upload', async (_event, payload: { connectionId: string; local: string; remote: string }) => {
        try {
            const success = await sshService.uploadFile(payload.connectionId, payload.local, payload.remote, (transferred, total) => {
                send('ssh:uploadProgress', { connectionId: payload.connectionId, transferred, total });
            });
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:download', async (_event, payload: { connectionId: string; remote: string; local: string }) => {
        try {
            const success = await sshService.downloadFile(payload.connectionId, payload.remote, payload.local, (transferred, total) => {
                send('ssh:downloadProgress', { connectionId: payload.connectionId, transferred, total });
            });
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });
}

function registerSystemHandlers(
    sshService: SSHService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:getSystemStats', async (_event, connectionId: string) => {
        try {
            return await sshService.getSystemStats(connectionId);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { error: message, uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' };
        }
    });

    secureHandle('ssh:getInstalledPackages', async (_event, connectionId: string, manager?: 'apt' | 'npm' | 'pip') => {
        try {
            return await sshService.getInstalledPackages(connectionId, manager);
        } catch {
            return [];
        }
    });

    secureHandle('ssh:getLogFiles', async (_event, connectionId: string) => {
        try {
            return await sshService.getLogFiles(connectionId);
        } catch {
            return [];
        }
    });

    secureHandle('ssh:readLogFile', async (_event, payload: { connectionId: string; path: string; lines?: number }) => {
        try {
            return await sshService.readLogFile(payload.connectionId, payload.path, payload.lines);
        } catch (error) {
            return getErrorMessage(error as Error);
        }
    });
}
