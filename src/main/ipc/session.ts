import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { SessionModuleRegistryService } from '@main/services/session/session-module-registry.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_CHANNELS } from '@shared/constants/ipc-channels';
import {
    SessionEventEnvelopeSchema,
} from '@shared/schemas/session-engine.schema';
import {
    sessionCapabilityListResponseSchema,
    sessionHealthResponseSchema,
    sessionListRequestSchema,
    sessionListResponseSchema,
    sessionStateRequestSchema,
    sessionStateResponseSchema,
} from '@shared/schemas/session-ipc.schema';
import { BrowserWindow, ipcMain } from 'electron';

export function registerSessionIpc(
    getMainWindow: () => BrowserWindow | null,
    sessionDirectoryService: SessionDirectoryService,
    sessionModuleRegistryService: SessionModuleRegistryService,
    eventBusService: EventBusService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'session operation');

    eventBusService.onCustom('session:event', payload => {
        const parsed = SessionEventEnvelopeSchema.safeParse(payload);
        if (!parsed.success) {
            appLogger.warn('SessionIPC', 'Ignoring invalid session event payload');
            return;
        }

        const window = getMainWindow();
        if (!window || window.isDestroyed()) {
            return;
        }

        window.webContents.send(SESSION_CHANNELS.EVENT, parsed.data);
    });

    ipcMain.handle(
        SESSION_CHANNELS.GET_STATE,
        createValidatedIpcHandler(
            SESSION_CHANNELS.GET_STATE,
            async (event, sessionId: string) => {
                validateSender(event);
                return sessionDirectoryService.getSnapshot(sessionId);
            },
            {
                argsSchema: sessionStateRequestSchema,
                responseSchema: sessionStateResponseSchema,
                normalizeArgs: ([sessionId]) => [sessionId] as [string],
            }
        )
    );

    ipcMain.handle(
        SESSION_CHANNELS.LIST,
        createValidatedIpcHandler(
            SESSION_CHANNELS.LIST,
            async event => {
                validateSender(event);
                return sessionDirectoryService.listRecoverySnapshots();
            },
            {
                argsSchema: sessionListRequestSchema,
                responseSchema: sessionListResponseSchema,
            }
        )
    );

    ipcMain.handle(
        SESSION_CHANNELS.LIST_CAPABILITIES,
        createValidatedIpcHandler(
            SESSION_CHANNELS.LIST_CAPABILITIES,
            async event => {
                validateSender(event);
                return sessionModuleRegistryService.listCapabilityDescriptors();
            },
            {
                argsSchema: sessionListRequestSchema,
                responseSchema: sessionCapabilityListResponseSchema,
            }
        )
    );

    ipcMain.handle(
        SESSION_CHANNELS.HEALTH,
        createValidatedIpcHandler(
            SESSION_CHANNELS.HEALTH,
            async event => {
                validateSender(event);
                const snapshots = sessionDirectoryService.listRecoverySnapshots();
                return {
                    status: 'ready',
                    activeSessions: snapshots.length,
                };
            },
            {
                argsSchema: sessionListRequestSchema,
                responseSchema: sessionHealthResponseSchema,
            }
        )
    );
}
