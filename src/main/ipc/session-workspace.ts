import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { UacCanvasEdgeRecord, UacCanvasNodeRecord } from '@main/services/data/repositories/uac.repository';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_WORKSPACE_CHANNELS } from '@shared/constants/ipc-channels';
import {
    sessionCanvasEdgeRecordSchema,
    sessionCanvasNodeRecordSchema,
} from '@shared/schemas/session-workspace-ipc.schema';
import type {
    SessionCanvasEdgeRecord,
    SessionCanvasNodeRecord,
} from '@shared/types/session-workspace';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

const mapCanvasNodeRecord = (record: UacCanvasNodeRecord): SessionCanvasNodeRecord => ({
    id: record.id,
    type: record.type,
    position: {
        x: record.position_x,
        y: record.position_y,
    },
    data: JSON.parse(record.data) as SessionCanvasNodeRecord['data'],
});

const mapCanvasEdgeRecord = (record: UacCanvasEdgeRecord): SessionCanvasEdgeRecord => ({
    id: record.id,
    source: record.source,
    target: record.target,
    sourceHandle: record.source_handle ?? undefined,
    targetHandle: record.target_handle ?? undefined,
});

export function registerSessionWorkspaceIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService?: DatabaseService
): void {
    const validateSender = createMainWindowSenderValidator(
        getMainWindow,
        'session workspace operation'
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_NODES,
        createValidatedIpcHandler<void, [SessionCanvasNodeRecord[]]>(
            SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_NODES,
            async (event, nodes): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }

                await databaseService.uac.saveCanvasNodes(nodes);
            },
            {
                argsSchema: z.tuple([z.array(sessionCanvasNodeRecordSchema)]),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.GET_CANVAS_NODES,
        createValidatedIpcHandler<SessionCanvasNodeRecord[], []>(
            SESSION_WORKSPACE_CHANNELS.GET_CANVAS_NODES,
            async event => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }

                const records = await databaseService.uac.getCanvasNodes();
                return records.map(mapCanvasNodeRecord);
            },
            {
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_NODE,
        createValidatedIpcHandler<void, [string]>(
            SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_NODE,
            async (event, id): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }

                await databaseService.uac.deleteCanvasNode(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_EDGES,
        createValidatedIpcHandler<void, [SessionCanvasEdgeRecord[]]>(
            SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_EDGES,
            async (event, edges): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }

                await databaseService.uac.saveCanvasEdges(edges);
            },
            {
                argsSchema: z.tuple([z.array(sessionCanvasEdgeRecordSchema)]),
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.GET_CANVAS_EDGES,
        createValidatedIpcHandler<SessionCanvasEdgeRecord[], []>(
            SESSION_WORKSPACE_CHANNELS.GET_CANVAS_EDGES,
            async event => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }

                const records = await databaseService.uac.getCanvasEdges();
                return records.map(mapCanvasEdgeRecord);
            },
            {
                wrapResponse: true,
            }
        )
    );

    ipcMain.handle(
        SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_EDGE,
        createValidatedIpcHandler<void, [string]>(
            SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_EDGE,
            async (event, id): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }

                await databaseService.uac.deleteCanvasEdge(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true,
            }
        )
    );
}
