import { getRuntimeStartupDecisions } from '@main/startup/runtime-startup-gate';
import { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { describe, expect, it } from 'vitest';

function createRuntimeStatus(
    statuses: Partial<Record<'tengra-db-service' | 'cliproxy-embed', 'ready' | 'missing' | 'not-executable' | 'external' | 'unsupported'>>
): RuntimeBootstrapExecutionResult {
    return {
        manifestVersion: 'v1.0.0',
        environment: {
            platform: 'win32',
            arch: 'x64',
        },
        entries: [],
        summary: {
            ready: 0,
            installed: 0,
            installRequired: 0,
            failed: 0,
            external: 0,
            unsupported: 0,
            blockingFailures: 0,
        },
        health: {
            entries: Object.entries(statuses).map(([componentId, status]) => ({
                componentId,
                displayName: componentId,
                status,
                source: status === 'external' ? 'external' : 'managed',
                requirement: 'required',
                message: status,
            })),
            summary: {
                ready: 0,
                missing: 0,
                invalid: 0,
                external: 0,
                unsupported: 0,
            },
        },
    };
}

describe('runtime startup gate', () => {
    it('allows managed services to start when health entries are ready or external', () => {
        const decisions = getRuntimeStartupDecisions(
            createRuntimeStatus({
                'tengra-db-service': 'ready',
                'cliproxy-embed': 'external',
            })
        );

        expect(decisions.database.shouldStart).toBe(true);
        expect(decisions.database.reason).toBe('ready');
        expect(decisions.embeddedProxy.shouldStart).toBe(true);
        expect(decisions.embeddedProxy.reason).toBe('ready');
    });

    it('blocks managed services when the runtime health is missing or invalid', () => {
        const decisions = getRuntimeStartupDecisions(
            createRuntimeStatus({
                'tengra-db-service': 'missing',
                'cliproxy-embed': 'not-executable',
            })
        );

        expect(decisions.database.shouldStart).toBe(false);
        expect(decisions.database.reason).toBe('blocked');
        expect(decisions.embeddedProxy.shouldStart).toBe(false);
        expect(decisions.embeddedProxy.reason).toBe('blocked');
    });

    it('treats services without managed runtime entries as unmanaged and startable', () => {
        const decisions = getRuntimeStartupDecisions(null);

        expect(decisions.database.shouldStart).toBe(true);
        expect(decisions.database.reason).toBe('unmanaged');
        expect(decisions.embeddedProxy.shouldStart).toBe(true);
        expect(decisions.embeddedProxy.reason).toBe('unmanaged');
    });
});
