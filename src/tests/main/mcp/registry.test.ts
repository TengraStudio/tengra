import { buildMcpServices } from '@main/mcp/registry';
import { McpDeps } from '@main/mcp/server-utils';
import { describe, expect, it } from 'vitest';

function createMockDeps(): McpDeps {
    return {
        web: { fetchJson: async () => ({ success: true, data: {} }) },
        utility: { storeMemory: async () => ({ success: true }), recallMemory: async () => ({ success: true }) },
        system: {},
        ssh: {},
        screenshot: {},
        scanner: {},
        notification: {},
        network: {},
        monitoring: {},
        git: {},
        security: {},
        settings: { getSettings: () => ({}) },
        filesystem: {},
        file: {},
        embedding: {},
        docker: { listContainers: async () => ({ success: true }), getStats: async () => ({ success: true }) },
        database: {},
        content: {},
        command: {},
        clipboard: {},
        ollama: {},
        advancedMemory: {},
        ideaGenerator: {},
        modelCollaboration: {},
        rateLimit: { waitForToken: async () => undefined },
        auditLog: undefined
    } as unknown as McpDeps;
}

describe('MCP registry', () => {
    it('contains new specialized servers', () => {
        const services = buildMcpServices(createMockDeps());
        const names = new Set(services.map(s => s.name));

        expect(names.has('database-admin')).toBe(true);
        expect(names.has('cloud-storage')).toBe(true);
        expect(names.has('cicd')).toBe(true);
    });
});

