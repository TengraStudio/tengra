import { WORKSPACE_COMPAT_ALIAS_VALUES, WORKSPACE_COMPAT_TARGET_VALUES } from '@shared/constants';
import type { JoinCollaborationRoom } from '@shared/schemas/collaboration.schema';

export type CollaborationRoomType = JoinCollaborationRoom['type'];
export type CollaborationRoomTypeInput = CollaborationRoomType | typeof WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR;

export function normalizeCollaborationRoomType(
    type: CollaborationRoomTypeInput
): CollaborationRoomType {
    return type === WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR ? WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE : type;
}
