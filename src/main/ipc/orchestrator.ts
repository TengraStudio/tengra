import { MultiAgentOrchestratorService } from '@main/services/workspace/orchestrator.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { OrchestratorState, WorkspaceStep } from '@shared/types/automation-workflow';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for the multi-agent orchestrator.
 * Forwards orchestrator state updates to the renderer process and
 * exposes channels to start, approve, stop, and query orchestration state.
 *
 * @param orchestrator - The orchestrator service instance
 * @param getMainWindow - Factory function to retrieve the active BrowserWindow
 */
export function registerOrchestratorIpc(
    orchestrator: MultiAgentOrchestratorService,
    getMainWindow: () => BrowserWindow | null
): void {
    const eventBus = orchestrator.eventBus;
    eventBus.on('orchestrator:update', (state: OrchestratorState) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('orchestrator:update', state);
        }
    });

    ipcMain.handle(
        'orchestrator:start',
        createIpcHandler<void, [string, string | undefined]>(
            'orchestrator:start',
            async (_event: IpcMainInvokeEvent, task: string, workspaceId?: string) => {
                if (typeof task !== 'string' || task.trim().length === 0) {
                    throw new Error('Task must be a non-empty string');
                }
                if (workspaceId !== undefined && typeof workspaceId !== 'string') {
                    throw new Error('Workspace ID must be a string');
                }
                await orchestrator.orchestrate(task, workspaceId);
            }
        )
    );

    ipcMain.handle(
        'orchestrator:approve',
        createIpcHandler<void, [WorkspaceStep[]]>(
            'orchestrator:approve',
            async (_event: IpcMainInvokeEvent, plan: WorkspaceStep[]) => {
                if (!Array.isArray(plan)) {
                    throw new Error('Plan must be an array of WorkspaceStep');
                }
                await orchestrator.approvePlan(plan);
            }
        )
    );

    ipcMain.handle(
        'orchestrator:get-state',
        createSafeIpcHandler<OrchestratorState>(
            'orchestrator:get-state',
            async (_event: IpcMainInvokeEvent) => {
                return orchestrator.getState();
            },
            { status: 'idle', currentTask: '', plan: [], history: [], assignments: {} }
        )
    );

    ipcMain.handle(
        'orchestrator:stop',
        createIpcHandler<void>(
            'orchestrator:stop',
            async (_event: IpcMainInvokeEvent) => {
                await orchestrator.stop();
            }
        )
    );
}

