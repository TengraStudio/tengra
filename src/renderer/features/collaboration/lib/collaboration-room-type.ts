/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WORKSPACE_COMPAT_ALIAS_VALUES, WORKSPACE_COMPAT_TARGET_VALUES } from '@shared/constants';
import type { JoinCollaborationRoom } from '@shared/schemas/collaboration.schema';

export type CollaborationRoomType = JoinCollaborationRoom['type'];
export type CollaborationRoomTypeInput = CollaborationRoomType | typeof WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR;

export function normalizeCollaborationRoomType(
    type: CollaborationRoomTypeInput
): CollaborationRoomType {
    return type === WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR ? WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE : type;
}

