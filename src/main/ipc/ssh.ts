import { randomUUID } from 'crypto';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { sshConnectionSchema, sshProfileSchema, validateIpc } from '@main/ipc/validation';
import { appLogger } from '@main/logging/logger';
import { SSHConnection, SSHService } from '@main/services/project/ssh.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { IPC_PERFORMANCE_BUDGETS,ipcMetricsStore } from '@main/utils/ipc-telemetry.util';
import { IpcValue, JsonValue } from '@shared/types/common';
import { AppErrorCode, getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum content size for SSH file writes (50 MB) */
const MAX_SSH_CONTENT_SIZE = 50 * 1024 * 1024;

/** Validates an SSH path, rejecting traversal sequences and dangerous characters. */
function validateSshPath(path: string, label: string): void {
    if (path.includes('..') || path.includes('\0') || path.includes('\r') || path.includes('\n')) {
        throw new Error(`Invalid SSH path for ${label}: path contains forbidden characters`);
    }
}

/** Validates an SSH command, rejecting newlines and null bytes that enable injection. */
function validateSshCommand(command: string): void {
    if (command.includes('\n') || command.includes('\r') || command.includes('\0')) {
        throw new Error('Invalid SSH command: command contains forbidden control characters');
    }
}

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
            const startTime = Date.now();
            const budget = IPC_PERFORMANCE_BUDGETS[channel];
            try {
                const result = await handler(event, ...args);
                const duration = Date.now() - startTime;
                appLogger.debug('SSH', `[${channel}] Success in ${duration}ms`);

                // Record telemetry metrics
                ipcMetricsStore.recordSuccess(channel, duration);
                if (budget && duration > budget) {
                    appLogger.warn('SSH', `[${channel}] Exceeded performance budget: ${duration}ms > ${budget}ms`);
                }

                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                const message = getErrorMessage(error as Error);
                appLogger.error('SSH', `[${channel}] Failed in ${duration}ms: ${message}`);

                // Record telemetry failure
                const errorCode = error instanceof Error && 'code' in error
                    ? String((error as { code?: string }).code)
                    : AppErrorCode.UNKNOWN;
                ipcMetricsStore.recordFailure(channel, duration, errorCode);

                throw error;
            }
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
    registerTunnelHandlers(sshService, secureHandle);
    registerAdvancedSshHandlers(sshService, secureHandle);
    registerKeyManagementHandlers(sshService, secureHandle);
    registerHealthHandlers(sshService, rateLimitService, secureHandle);

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
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return {
                success: false,
                error: message,
                code: AppErrorCode.SSH_PROFILE_SAVE_FAILED
            };
        }
    });

    secureHandle('ssh:deleteProfile', async (_event, id: string) => {
        try {
            return await sshService.deleteProfile(id);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return {
                success: false,
                error: message,
                code: AppErrorCode.SSH_PROFILE_DELETE_FAILED
            };
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
            validateSshCommand(command);
            appLogger.info('SSH', `[ssh:execute] Executing command on ${connectionId}`);
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
            validateSshPath(payload.path, 'ssh:listDir');
            return await sshService.listDirectory(payload.connectionId, payload.path);
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:readFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            validateSshPath(payload.path, 'ssh:readFile');
            const content = await sshService.readFile(payload.connectionId, payload.path);
            return { success: true, content };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:writeFile', async (_event, payload: { connectionId: string; path: string; content: string }) => {
        try {
            validateSshPath(payload.path, 'ssh:writeFile');
            if (payload.content.length > MAX_SSH_CONTENT_SIZE) {
                return { success: false, error: `Content exceeds maximum size of ${MAX_SSH_CONTENT_SIZE} bytes` };
            }
            const success = await sshService.writeFile(payload.connectionId, payload.path, payload.content);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:deleteDir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            validateSshPath(payload.path, 'ssh:deleteDir');
            const success = await sshService.deleteDirectory(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:deleteFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            validateSshPath(payload.path, 'ssh:deleteFile');
            const success = await sshService.deleteFile(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:mkdir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            validateSshPath(payload.path, 'ssh:mkdir');
            const success = await sshService.createDirectory(payload.connectionId, payload.path);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:rename', async (_event, payload: { connectionId: string; oldPath: string; newPath: string }) => {
        try {
            validateSshPath(payload.oldPath, 'ssh:rename oldPath');
            validateSshPath(payload.newPath, 'ssh:rename newPath');
            const success = await sshService.rename(payload.connectionId, payload.oldPath, payload.newPath);
            return { success };
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) };
        }
    });

    secureHandle('ssh:upload', async (_event, payload: { connectionId: string; local: string; remote: string }) => {
        try {
            validateSshPath(payload.local, 'ssh:upload local');
            validateSshPath(payload.remote, 'ssh:upload remote');
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
            validateSshPath(payload.remote, 'ssh:download remote');
            validateSshPath(payload.local, 'ssh:download local');
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
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, code: AppErrorCode.SSH_COMMAND_FAILED, packages: [] };
        }
    });

    secureHandle('ssh:getLogFiles', async (_event, connectionId: string) => {
        try {
            return await sshService.getLogFiles(connectionId);
        } catch (error) {
            const message = getErrorMessage(error as Error);
            return { success: false, error: message, code: AppErrorCode.SSH_COMMAND_FAILED, files: [] };
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

function registerTunnelHandlers(
    sshService: SSHService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle(
        'ssh:createTunnel',
        async (
            _event,
            payload: {
                connectionId: string;
                type: 'local' | 'remote' | 'dynamic';
                localHost: string;
                localPort: number;
                remoteHost?: string;
                remotePort?: number;
            }
        ) => {
            if (payload.type === 'local') {
                return sshService.createLocalForward(
                    payload.connectionId,
                    payload.localHost,
                    payload.localPort,
                    payload.remoteHost ?? '127.0.0.1',
                    payload.remotePort ?? 0
                );
            }
            if (payload.type === 'remote') {
                return sshService.createRemoteForward(
                    payload.connectionId,
                    payload.remoteHost ?? '127.0.0.1',
                    payload.remotePort ?? 0,
                    payload.localHost,
                    payload.localPort
                );
            }
            return sshService.createDynamicForward(
                payload.connectionId,
                payload.localHost,
                payload.localPort
            );
        }
    );

    secureHandle('ssh:listTunnels', async (_event, connectionId?: string) =>
        sshService.getPortForwards(connectionId)
    );
    secureHandle('ssh:closeTunnel', async (_event, forwardId: string) =>
        sshService.closePortForward(forwardId)
    );

    secureHandle(
        'ssh:saveTunnelPreset',
        async (
            _event,
            payload: {
                name: string;
                type: 'local' | 'remote' | 'dynamic';
                localHost: string;
                localPort: number;
                remoteHost: string;
                remotePort: number;
            }
        ) => sshService.saveTunnelPreset(payload)
    );
    secureHandle('ssh:listTunnelPresets', async () => sshService.listTunnelPresets());
    secureHandle('ssh:deleteTunnelPreset', async (_event, id: string) => sshService.deleteTunnelPreset(id));
}

function registerAdvancedSshHandlers(
    sshService: SSHService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle(
        'ssh:searchRemoteFiles',
        async (
            _event,
            payload: {
                connectionId: string;
                query: string;
                options?: { path?: string; contentSearch?: boolean; limit?: number };
            }
        ) => sshService.searchRemoteFiles(payload.connectionId, payload.query, payload.options)
    );
    secureHandle('ssh:getSearchHistory', async (_event, connectionId?: string) =>
        sshService.getSearchHistory(connectionId)
    );
    secureHandle('ssh:exportSearchHistory', async () => sshService.exportSearchHistory());
    secureHandle('ssh:reconnect', async (_event, connectionId: string, retries?: number) =>
        sshService.reconnectConnection(connectionId, retries)
    );
    secureHandle('ssh:acquireConnection', async (_event, connectionId: string) =>
        sshService.acquireConnection(connectionId)
    );
    secureHandle('ssh:releaseConnection', async (_event, connectionId: string) =>
        sshService.releaseConnection(connectionId)
    );
    secureHandle('ssh:getConnectionPoolStats', async () => sshService.getConnectionPoolStats());
    secureHandle('ssh:enqueueTransfer', async (_event, task: unknown) =>
        sshService.enqueueTransfer(task as never)
    );
    secureHandle('ssh:getTransferQueue', async () => sshService.getTransferQueue());
    secureHandle('ssh:runTransferBatch', async (_event, tasks: unknown, concurrency?: number) =>
        sshService.runTransferBatch(tasks as never, concurrency)
    );
    secureHandle('ssh:listRemoteContainers', async (_event, connectionId: string) =>
        sshService.listRemoteContainers(connectionId)
    );
    secureHandle(
        'ssh:runRemoteContainer',
        async (
            _event,
            payload: {
                connectionId: string;
                image: string;
                name: string;
                ports?: Array<{ hostPort: number; containerPort: number }>;
            }
        ) => sshService.runRemoteContainer(payload.connectionId, payload.image, payload.name, payload.ports)
    );
    secureHandle('ssh:stopRemoteContainer', async (_event, connectionId: string, containerId: string) =>
        sshService.stopRemoteContainer(connectionId, containerId)
    );
    secureHandle('ssh:saveProfileTemplate', async (_event, template: unknown) =>
        sshService.saveProfileTemplate(template as never)
    );
    secureHandle('ssh:listProfileTemplates', async () => sshService.listProfileTemplates());
    secureHandle('ssh:deleteProfileTemplate', async (_event, id: string) =>
        sshService.deleteProfileTemplate(id)
    );
    secureHandle('ssh:exportProfiles', async (_event, ids?: string[]) => sshService.exportProfiles(ids));
    secureHandle('ssh:importProfiles', async (_event, payload: string) => sshService.importProfiles(payload));
    secureHandle('ssh:validateProfile', async (_event, profile: unknown) =>
        sshService.validateProfile(profile as never)
    );
    secureHandle('ssh:testProfile', async (_event, profile: unknown) =>
        sshService.testProfile(profile as never)
    );
    secureHandle('ssh:startSessionRecording', async (_event, connectionId: string) =>
        sshService.startSessionRecording(connectionId)
    );
    secureHandle('ssh:stopSessionRecording', async (_event, connectionId: string) =>
        sshService.stopSessionRecording(connectionId)
    );
    secureHandle('ssh:getSessionRecording', async (_event, connectionId: string) =>
        sshService.getSessionRecording(connectionId)
    );
    secureHandle('ssh:searchSessionRecording', async (_event, connectionId: string, query: string) =>
        sshService.searchSessionRecording(connectionId, query)
    );
    secureHandle('ssh:exportSessionRecording', async (_event, connectionId: string) =>
        sshService.exportSessionRecording(connectionId)
    );
    secureHandle('ssh:listSessionRecordings', async () => sshService.listSessionRecordings());
}

function registerKeyManagementHandlers(
    sshService: SSHService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:listManagedKeys', async () => sshService.listManagedKeys());

    secureHandle(
        'ssh:generateManagedKey',
        async (
            _event,
            payload: { name: string; passphrase?: string }
        ) => sshService.generateManagedKey(payload.name, payload.passphrase)
    );

    secureHandle(
        'ssh:importManagedKey',
        async (
            _event,
            payload: { name: string; privateKey: string; passphrase?: string }
        ) => sshService.importManagedKey(payload.name, payload.privateKey, payload.passphrase)
    );

    secureHandle('ssh:deleteManagedKey', async (_event, id: string) => sshService.deleteManagedKey(id));

    secureHandle(
        'ssh:rotateManagedKey',
        async (_event, payload: { id: string; nextPassphrase?: string }) =>
            sshService.rotateManagedKey(payload.id, payload.nextPassphrase)
    );

    secureHandle('ssh:backupManagedKey', async (_event, id: string) => sshService.backupManagedKey(id));
    secureHandle('ssh:listKnownHosts', async () => sshService.listKnownHosts());
    secureHandle(
        'ssh:addKnownHost',
        async (_event, payload: { host: string; keyType: string; publicKey: string }) =>
            sshService.addKnownHost(payload)
    );
    secureHandle(
        'ssh:removeKnownHost',
        async (_event, payload: { host: string; keyType?: string }) =>
            sshService.removeKnownHost(payload.host, payload.keyType)
    );
}

function registerHealthHandlers(
    sshService: SSHService,
    _rateLimitService: RateLimitService,
    secureHandle: <Args extends unknown[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<unknown>
    ) => void
) {
    secureHandle('ssh:health', async () => {
        const activeConnections = sshService.getAllConnections();
        const poolStats = sshService.getConnectionPoolStats();

        // Determine health status based on metrics
        const status = 'healthy';

        return {
            status,
            activeConnections: activeConnections.length,
            connectedCount: activeConnections.filter(c => c.connected).length,
            poolStats: poolStats,
            timestamp: Date.now(),
        };
    });
}
