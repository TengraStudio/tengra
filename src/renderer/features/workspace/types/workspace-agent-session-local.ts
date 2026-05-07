/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AgentEventRecord } from '@shared/types/agent-state';
import type { JsonObject } from '@shared/types/common';
import type { WorkspaceStep } from '@shared/types/council';
import type {
    CouncilAssistEvent,
    CouncilInterAgentMessage,
    CouncilReviewDecision,
    CouncilRunConfig,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSession,
    WorkspaceAgentSessionModes,
} from '@shared/types/workspace-agent-session';

export interface SessionCouncilState {
    proposal: WorkspaceStep[];
    timeline: AgentEventRecord[];
}

export interface SessionCouncilRuntime extends JsonObject {
    chairman?: CouncilSubagentRuntime;
    subagents: CouncilSubagentRuntime[];
    drafts: CouncilSubagentWorkspaceDraft[];
    reviewQueue: CouncilSubagentWorkspaceDraft[];
    decisions: CouncilReviewDecision[];
    assistEvents: CouncilAssistEvent[];
    messages: CouncilInterAgentMessage[];
}

export interface WorkspaceAgentSessionMetadata extends JsonObject {
    status?: WorkspaceAgentSession['status'];
    modes?: WorkspaceAgentSessionModes;
    strategy?: WorkspaceAgentSession['strategy'];
    permissionPolicy?: WorkspaceAgentPermissionPolicy;
    background?: boolean;
    archived?: boolean;
    councilConfig?: CouncilRunConfig;
    council?: SessionCouncilRuntime;
}

export const EMPTY_COUNCIL_STATE: SessionCouncilState = {
    proposal: [],
    timeline: [],
};

