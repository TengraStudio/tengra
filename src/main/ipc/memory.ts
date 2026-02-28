import { appLogger } from '@main/logging/logger';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { MemoryService } from '@main/services/llm/memory.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum ID length */
const MAX_ID_LENGTH = 128;
/** Maximum content length (10KB) */
const MAX_CONTENT_LENGTH = 10 * 1024;
/** Maximum query length */
const MAX_QUERY_LENGTH = 1024;
/** Maximum tags count */
const MAX_TAGS_COUNT = 20;
/** Maximum tag length */
const MAX_TAG_LENGTH = 64;
/** Maximum field name length */
const MAX_FIELD_LENGTH = 256;

/**
 * Validates a string ID
 */
function validateId(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ID_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates content string
 */
function validateContent(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_CONTENT_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a query string
 */
function validateQuery(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a field name
 */
function validateField(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_FIELD_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates and sanitizes tags array
 */
function validateTags(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0 && tag.length <= MAX_TAG_LENGTH)
        .slice(0, MAX_TAGS_COUNT);
}

/**
 * Registers IPC handlers for memory operations
 */
export function registerMemoryIpc(getMainWindow: () => BrowserWindow | null, memoryService: MemoryService): void {
    appLogger.info('MemoryIPC', 'Registering memory IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'memory operation');

    ipcMain.handle(
        'memory:getAll',
        createSafeIpcHandler(
            'memory:getAll',
            async (event) => {
                validateSender(event);
                return await memoryService.getAllMemories();
            },
            { facts: [], episodes: [], entities: [] }
        )
    );

    ipcMain.handle(
        'memory:deleteFact',
        createSafeIpcHandler(
            'memory:deleteFact',
            async (event: IpcMainInvokeEvent, factIdRaw: unknown) => {
                validateSender(event);
                const factId = validateId(factIdRaw);
                if (!factId) {
                    throw new Error('Invalid fact ID');
                }
                const success = await memoryService.forgetFact(factId);
                return { success };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'memory:deleteEntity',
        createSafeIpcHandler(
            'memory:deleteEntity',
            async (event: IpcMainInvokeEvent, entityIdRaw: unknown) => {
                validateSender(event);
                const entityId = validateId(entityIdRaw);
                if (!entityId) {
                    throw new Error('Invalid entity ID');
                }
                const success = await memoryService.removeEntityFact(entityId);
                return { success };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'memory:addFact',
        createSafeIpcHandler(
            'memory:addFact',
            async (event: IpcMainInvokeEvent, contentRaw: unknown, tagsRaw: unknown) => {
                validateSender(event);
                const content = validateContent(contentRaw);
                if (!content) {
                    throw new Error('Invalid content');
                }
                const tags = validateTags(tagsRaw);
                const fragment = await memoryService.rememberFact(content, 'manual', 'user-added', tags);
                return { success: true, id: fragment.id };
            },
            { success: false, id: '' }
        )
    );

    ipcMain.handle(
        'memory:setEntityFact',
        createSafeIpcHandler(
            'memory:setEntityFact',
            async (
                event: IpcMainInvokeEvent,
                entityTypeRaw: unknown,
                entityNameRaw: unknown,
                keyRaw: unknown,
                valueRaw: unknown
            ) => {
                validateSender(event);
                const entityType = validateField(entityTypeRaw);
                const entityName = validateField(entityNameRaw);
                const key = validateField(keyRaw);
                const value = validateContent(valueRaw);

                if (!entityType || !entityName || !key || !value) {
                    throw new Error('Invalid parameters');
                }

                const knowledge = await memoryService.setEntityFact(entityType, entityName, key, value);
                return { success: true, id: knowledge.id };
            },
            { success: false, id: '' }
        )
    );

    ipcMain.handle(
        'memory:search',
        createSafeIpcHandler(
            'memory:search',
            async (event: IpcMainInvokeEvent, queryRaw: unknown) => {
                validateSender(event);
                const query = validateQuery(queryRaw);
                if (!query) {
                    throw new Error('Invalid query');
                }
                const facts = await memoryService.recallRelevantFacts(query, 10);
                const episodes = await memoryService.recallEpisodes(query, 5);
                return { facts, episodes };
            },
            { facts: [], episodes: [] }
        )
    );
}
