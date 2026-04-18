/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { z } from 'zod';

/**
 * Zod schema for joining a collaborative session.
 * Used for both group chats and multi-user workspace editing.
 */
export const JoinCollaborationRoomSchema = z.object({
    type: z.enum(['chat', 'workspace']),
    id: z.string(),
});

export type JoinCollaborationRoom = z.infer<typeof JoinCollaborationRoomSchema>;

/**
 * Payload for outgoing synchronization updates.
 */
export const CollaborationSyncUpdateSchema = z.object({
    roomId: z.string(),
    data: z.any(), // Typically Yjs update or Chat message
});

export type CollaborationSyncUpdate = z.infer<typeof CollaborationSyncUpdateSchema>;

/**
 * Standard response for collaboration IPC calls.
 */
export const CollaborationResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type CollaborationResponse = z.infer<typeof CollaborationResponseSchema>;

/**
 * Presence and metadata for collaborative participants.
 */
export const ParticipantSchema = z.object({
    userId: z.string(),
    status: z.enum(['online', 'away', 'offline']),
    lastSeen: z.number(),
    lastAction: z.string().optional(),
});

export type Participant = z.infer<typeof ParticipantSchema>;
