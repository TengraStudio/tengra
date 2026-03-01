/**
 * Database Stats IPC Handler
 * Returns detailed database statistics for the dashboard UI.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { DatabaseService } from '@main/services/data/database.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Detailed database statistics for the size dashboard. */
export interface DatabaseSizeStats {
    dbSize: number;
    chatCount: number;
    messageCount: number;
    projectCount: number;
    folderCount: number;
    promptCount: number;
}

/**
 * Registers IPC handler for detailed database statistics.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param databaseService - The database service instance.
 */
export function registerDbStatsIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService: DatabaseService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'db stats');

    ipcMain.handle('db:size-stats', createIpcHandler(
        'db:size-stats',
        async (event: IpcMainInvokeEvent): Promise<DatabaseSizeStats> => {
            validateSender(event);
            const stats = await databaseService.getStats();
            const projects = await databaseService.projects.getProjects();
            const folders = await databaseService.system.getFolders();
            const prompts = await databaseService.system.getPrompts();

            return {
                dbSize: stats.dbSize,
                chatCount: stats.chatCount,
                messageCount: stats.messageCount,
                projectCount: projects.length,
                folderCount: folders.length,
                promptCount: prompts.length,
            };
        }
    ));
}
