/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RuntimeBootstrapExecutionResult, RuntimeHealthStatus } from '@shared/types/runtime-manifest';

export interface RuntimeStartupDecision {
    componentId: string;
    shouldStart: boolean;
    reason: 'ready' | 'unmanaged' | 'blocked';
    status?: RuntimeHealthStatus;
}

const SERVICE_COMPONENT_IDS = {
    database: 'tengra-db-service',
    embeddedProxy: 'tengra-proxy',
} as const;

function resolveComponentDecision(
    runtimeStatus: RuntimeBootstrapExecutionResult | null,
    componentId: string
): RuntimeStartupDecision {
    const entry = runtimeStatus?.health.entries.find(item => item.componentId === componentId);
    if (!entry) {
        return {
            componentId,
            shouldStart: true,
            reason: 'unmanaged',
        };
    }

    if (entry.status === 'ready' || entry.status === 'external') {
        return {
            componentId,
            shouldStart: true,
            reason: 'ready',
            status: entry.status,
        };
    }

    return {
        componentId,
        shouldStart: false,
        reason: 'blocked',
        status: entry.status,
    };
}

export function getRuntimeStartupDecisions(
    runtimeStatus: RuntimeBootstrapExecutionResult | null
): {
    database: RuntimeStartupDecision;
    embeddedProxy: RuntimeStartupDecision;
} {
    return {
        database: resolveComponentDecision(runtimeStatus, SERVICE_COMPONENT_IDS.database),
        embeddedProxy: resolveComponentDecision(runtimeStatus, SERVICE_COMPONENT_IDS.embeddedProxy),
    };
}
