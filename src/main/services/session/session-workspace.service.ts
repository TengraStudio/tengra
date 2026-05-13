import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { UacCanvasEdgeRecord, UacCanvasNodeRecord } from '@main/services/data/repositories/uac.repository';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { SESSION_WORKSPACE_CHANNELS } from '@shared/constants/ipc-channels';
import { RuntimeValue } from '@shared/types/common';
import type {
    SessionCanvasEdgeRecord,
    SessionCanvasNodeRecord,
} from '@shared/types/session-workspace';

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

export class SessionWorkspaceService extends BaseService {
    static readonly serviceName = 'sessionWorkspaceService';
    static readonly dependencies = ['databaseService'] as const;
    constructor(private readonly databaseService: DatabaseService) {
        super('SessionWorkspaceService');
    }

    // --- IPC Decorated Methods ---

    @ipc(SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_NODES)
    async saveCanvasNodesIpc(nodes: SessionCanvasNodeRecord[]): Promise<RuntimeValue> {
        await this.databaseService.uac.saveCanvasNodes(nodes);
        return serializeToIpc(void 0);
    }

    @ipc(SESSION_WORKSPACE_CHANNELS.GET_CANVAS_NODES)
    async getCanvasNodesIpc(): Promise<RuntimeValue> {
        const records = await this.databaseService.uac.getCanvasNodes();
        const mapped = records.map(mapCanvasNodeRecord);
        return serializeToIpc(mapped);
    }

    @ipc(SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_NODE)
    async deleteCanvasNodeIpc(id: string): Promise<RuntimeValue> {
        await this.databaseService.uac.deleteCanvasNode(id);
        return serializeToIpc(void 0);
    }

    @ipc(SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_EDGES)
    async saveCanvasEdgesIpc(edges: SessionCanvasEdgeRecord[]): Promise<RuntimeValue> {
        await this.databaseService.uac.saveCanvasEdges(edges);
        return serializeToIpc(void 0);
    }

    @ipc(SESSION_WORKSPACE_CHANNELS.GET_CANVAS_EDGES)
    async getCanvasEdgesIpc(): Promise<RuntimeValue> {
        const records = await this.databaseService.uac.getCanvasEdges();
        const mapped = records.map(mapCanvasEdgeRecord);
        return serializeToIpc(mapped);
    }

    @ipc(SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_EDGE)
    async deleteCanvasEdgeIpc(id: string): Promise<RuntimeValue> {
        await this.databaseService.uac.deleteCanvasEdge(id);
        return serializeToIpc(void 0);
    }
}

