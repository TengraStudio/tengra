import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { UacCanvasEdgeRecord, UacCanvasNodeRecord } from '@main/services/data/repositories/uac.repository';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import type {
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
} from '@shared/types/workspace-agent';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

interface CanvasNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
}

interface CanvasEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export function registerWorkspaceAgentCanvasHandlers(
    getMainWindow: () => BrowserWindow | null,
    databaseService?: DatabaseService,
    workspaceAgentService?: WorkspaceAgentService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'canvas persistence');

    ipcMain.handle(
        'agent:save-canvas-nodes',
        createValidatedIpcHandler<void, [CanvasNode[]]>(
            'agent:save-canvas-nodes',
            async (event, nodes: CanvasNode[]): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.saveCanvasNodes(nodes);
            },
            {
                argsSchema: z.tuple([z.array(z.record(z.string(), z.any()))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-canvas-nodes',
        createValidatedIpcHandler<CanvasNode[], []>(
            'agent:get-canvas-nodes',
            async (event): Promise<CanvasNode[]> => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }
                const records = await databaseService.uac.getCanvasNodes();
                return records.map((record: UacCanvasNodeRecord) => ({
                    id: record.id,
                    type: record.type,
                    position: { x: record.position_x, y: record.position_y },
                    data: JSON.parse(record.data),
                }));
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:delete-canvas-node',
        createValidatedIpcHandler<void, [string]>(
            'agent:delete-canvas-node',
            async (event, id: string): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.deleteCanvasNode(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:save-canvas-edges',
        createValidatedIpcHandler<void, [CanvasEdge[]]>(
            'agent:save-canvas-edges',
            async (event, edges: CanvasEdge[]): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.saveCanvasEdges(edges);
            },
            {
                argsSchema: z.tuple([z.array(z.record(z.string(), z.any()))]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-canvas-edges',
        createValidatedIpcHandler<CanvasEdge[], []>(
            'agent:get-canvas-edges',
            async (event): Promise<CanvasEdge[]> => {
                validateSender(event);
                if (!databaseService) {
                    return [];
                }
                const records = await databaseService.uac.getCanvasEdges();
                return records.map((record: UacCanvasEdgeRecord) => ({
                    id: record.id,
                    source: record.source,
                    target: record.target,
                    sourceHandle: record.source_handle ?? undefined,
                    targetHandle: record.target_handle ?? undefined,
                }));
            },
            {
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:delete-canvas-edge',
        createValidatedIpcHandler<void, [string]>(
            'agent:delete-canvas-edge',
            async (event, id: string): Promise<void> => {
                validateSender(event);
                if (!databaseService) {
                    return;
                }
                await databaseService.uac.deleteCanvasEdge(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-templates',
        createValidatedIpcHandler<AgentTemplate[], [AgentTemplateCategory | undefined]>(
            'agent:get-templates',
            async (event, category?: AgentTemplateCategory): Promise<AgentTemplate[]> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return [];
                }
                if (category) {
                    return workspaceAgentService.getTemplatesByCategory(category);
                }
                return workspaceAgentService.getTemplates();
            },
            {
                argsSchema: z.tuple([z.string().optional()]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:save-template',
        createValidatedIpcHandler<{ success: boolean; error?: string }, [AgentTemplate]>(
            'agent:save-template',
            async (event, template: AgentTemplate): Promise<{ success: boolean; error?: string }> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return { success: false, error: 'Database not available' };
                }
                return await workspaceAgentService.saveTemplate(template);
            },
            {
                argsSchema: z.tuple([z.record(z.string(), z.any())]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:delete-template',
        createValidatedIpcHandler<{ success: boolean }, [string]>(
            'agent:delete-template',
            async (event, id: string): Promise<{ success: boolean }> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return { success: false };
                }
                const success = await workspaceAgentService.deleteTemplate(id);
                return { success };
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:export-template',
        createValidatedIpcHandler<AgentTemplateExport | null, [string]>(
            'agent:export-template',
            async (event, id: string): Promise<AgentTemplateExport | null> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return null;
                }
                return workspaceAgentService.exportTemplate(id);
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:import-template',
        createValidatedIpcHandler<{ success: boolean; template?: AgentTemplate; error?: string }, [AgentTemplateExport]>(
            'agent:import-template',
            async (event, exported: AgentTemplateExport): Promise<{ success: boolean; template?: AgentTemplate; error?: string }> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return { success: false, error: 'Database not available' };
                }
                try {
                    const template = await workspaceAgentService.importTemplate(exported);
                    return { success: true, template };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { success: false, error: message };
                }
            },
            {
                argsSchema: z.tuple([z.record(z.string(), z.any())]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:apply-template',
        createValidatedIpcHandler<{ success: boolean; error?: string; template?: AgentTemplate; task?: string; steps?: string[] }, [{ templateId: string; values: Record<string, string | number | boolean> }]>(
            'agent:apply-template',
            async (event, payload): Promise<{ success: boolean; error?: string; template?: AgentTemplate; task?: string; steps?: string[] }> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return { success: false, error: 'Workspace agent service not available' };
                }
                try {
                    const result = workspaceAgentService.applyTemplate(payload.templateId, payload.values);
                    return { success: true, ...result };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { success: false, error: message };
                }
            },
            {
                argsSchema: z.tuple([z.object({
                    templateId: z.string().min(1),
                    values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
                })]),
                wrapResponse: true
            }
        )
    );

    ipcMain.handle(
        'agent:get-template',
        createValidatedIpcHandler<AgentTemplate | null, [string]>(
            'agent:get-template',
            async (event, id: string): Promise<AgentTemplate | null> => {
                validateSender(event);
                if (!workspaceAgentService) {
                    return null;
                }
                return workspaceAgentService.getTemplates().find(template => template.id === id) ?? null;
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                wrapResponse: true
            }
        )
    );
}

/** @deprecated Use registerWorkspaceAgentCanvasHandlers instead */