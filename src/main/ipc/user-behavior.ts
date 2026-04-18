/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { UserBehaviorService } from '@main/services/analysis/user-behavior.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { UserBehaviorRecord, UserBehaviorRecordSchema } from '@shared/schemas/user-behavior.schema';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

// Schemas for User Behavior IPC
// Note: createValidatedIpcHandler expects a tuple schema for args since it validates the entire args array
const GetRecommendationsArgsSchema = z.tuple([
    z.object({
        limit: z.number().int().min(1).max(50).optional()
    })
]);

type GetRecommendationsArgs = z.infer<typeof GetRecommendationsArgsSchema>;

const GetRecommendationsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.string()),
    error: z.string().optional()
});

const GetRecentActivityArgsSchema = z.tuple([
    z.object({
        limit: z.number().int().min(1).max(100).optional()
    })
]);

type GetRecentActivityArgs = z.infer<typeof GetRecentActivityArgsSchema>;

const GetRecentActivityResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(UserBehaviorRecordSchema),
    error: z.string().optional()
});

const GetFrequentFeaturesArgsSchema = z.tuple([
    z.object({
        limit: z.number().int().min(1).max(50).optional()
    })
]);

type GetFrequentFeaturesArgs = z.infer<typeof GetFrequentFeaturesArgsSchema>;

const GetFrequentFeaturesResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.string()),
    error: z.string().optional()
});

/**
 * Registers User Behavior IPC handlers.
 * @param userBehaviorService The user behavior service instance.
 */
export function registerUserBehaviorIpc(userBehaviorService: UserBehaviorService): void {
    /**
     * Gets model recommendations based on user behavior.
     */
    ipcMain.handle(
        'user-behavior:get-model-recommendations',
        createValidatedIpcHandler<{ success: boolean; data: string[]; error?: string }, GetRecommendationsArgs>(
            'user-behavior:get-model-recommendations',
            async (_event: IpcMainInvokeEvent, argsObj: GetRecommendationsArgs[0]) => {
                try {
                    const recommendations = await userBehaviorService.getModelRecommendations(argsObj.limit);
                    return { success: true, data: recommendations };
                } catch (error) {
                    return { success: false, data: [], error: (error as Error).message };
                }
            },
            {
                argsSchema: GetRecommendationsArgsSchema,
                // SAFETY: Casting to ZodType with explicit shape to align with the return type of the handler.
                responseSchema: GetRecommendationsResponseSchema as z.ZodType<{ success: boolean; data: string[]; error?: string }>
            }
        )
    );

    /**
     * Gets recent user activity.
     */
    ipcMain.handle(
        'user-behavior:get-recent-activity',
        createValidatedIpcHandler<{ success: boolean; data: UserBehaviorRecord[]; error?: string }, GetRecentActivityArgs>(
            'user-behavior:get-recent-activity',
            async (_event: IpcMainInvokeEvent, argsObj: GetRecentActivityArgs[0]) => {
                try {
                    const activity = await userBehaviorService.getRecentActivity(argsObj.limit);
                    return { success: true, data: activity };
                } catch (error) {
                    return { success: false, data: [], error: (error as Error).message };
                }
            },
            {
                argsSchema: GetRecentActivityArgsSchema,
                // SAFETY: Casting to ZodType with explicit shape to align with the return type of the handler.
                responseSchema: GetRecentActivityResponseSchema as z.ZodType<{ success: boolean; data: UserBehaviorRecord[]; error?: string }>
            }
        )
    );

    /**
     * Gets frequently used features.
     */
    ipcMain.handle(
        'user-behavior:get-frequent-features',
        createValidatedIpcHandler<{ success: boolean; data: string[]; error?: string }, GetFrequentFeaturesArgs>(
            'user-behavior:get-frequent-features',
            async (_event: IpcMainInvokeEvent, argsObj: GetFrequentFeaturesArgs[0]) => {
                try {
                    const features = await userBehaviorService.getFrequentFeatures(argsObj.limit);
                    return { success: true, data: features };
                } catch (error) {
                    return { success: false, data: [], error: (error as Error).message };
                }
            },
            {
                argsSchema: GetFrequentFeaturesArgsSchema,
                // SAFETY: Casting to ZodType with explicit shape to align with the return type of the handler.
                responseSchema: GetFrequentFeaturesResponseSchema as z.ZodType<{ success: boolean; data: string[]; error?: string }>
            }
        )
    );
}
