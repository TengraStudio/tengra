import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { UserCollaborationService } from '@main/services/project/user-collaboration.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    CollaborationResponseSchema,
    CollaborationSyncUpdateSchema,
    JoinCollaborationRoomSchema} from '@shared/schemas/collaboration.schema';
import { BrowserWindow,ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

/**
 * registerUserCollaborationIpc
 * 
 * Registers IPC handlers for user-to-user real-time collaboration.
 * Bridges collaboration events from the main process EventBus to the renderer.
 */
export function registerUserCollaborationIpc(
    mainWindowGetter: () => BrowserWindow | null,
    collaborationService: UserCollaborationService,
    eventBus: EventBusService
): void {
    const validateSender = createMainWindowSenderValidator(mainWindowGetter, 'user-collaboration operation');

    // Helper:Forward specific event types to the renderer
    const forwardToRenderer = (channel: string, payload: unknown) => {
        const win = mainWindowGetter();
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, payload);
        }
    };

    // Bridging collaboration events
    eventBus.on('collaboration:joined', (payload) => forwardToRenderer('collaboration:sync:joined', payload));
    eventBus.on('collaboration:left', (payload) => forwardToRenderer('collaboration:sync:left', payload));
    eventBus.on('collaboration:sync', (payload) => forwardToRenderer('collaboration:sync:update', payload));
    eventBus.on('collaboration:error', (payload) => forwardToRenderer('collaboration:sync:error', payload));

    /**
     * Join a collaborative room.
     */
    ipcMain.handle('collaboration:sync:join', createValidatedIpcHandler(
        'collaboration:sync:join',
        async (event: IpcMainInvokeEvent, request: z.infer<typeof JoinCollaborationRoomSchema>) => {
            validateSender(event);
            await collaborationService.joinRoom(request.type, request.id);
            return { success: true };
        },
        {
            argsSchema: z.tuple([JoinCollaborationRoomSchema]),
            responseSchema: CollaborationResponseSchema,
            wrapResponse: true
        }
    ));

    /**
     * Send a synchronization update.
     */
    ipcMain.handle('collaboration:sync:send', createValidatedIpcHandler(
        'collaboration:sync:send',
        async (event: IpcMainInvokeEvent, request: z.infer<typeof CollaborationSyncUpdateSchema>) => {
            validateSender(event);
            await collaborationService.sendUpdate(request.roomId, request.data);
            return { success: true };
        },
        {
            argsSchema: z.tuple([CollaborationSyncUpdateSchema]),
            responseSchema: CollaborationResponseSchema,
            wrapResponse: true
        }
    ));

    /**
     * Leave a collaborative room.
     */
    ipcMain.handle('collaboration:sync:leave', createValidatedIpcHandler(
        'collaboration:sync:leave',
        async (event: IpcMainInvokeEvent, roomId: string) => {
            validateSender(event);
            await collaborationService.leaveRoom(roomId);
            return { success: true };
        },
        {
            argsSchema: z.tuple([z.string()]),
            responseSchema: CollaborationResponseSchema,
            wrapResponse: true
        }
    ));
}
