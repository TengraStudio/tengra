import { buildMcpServices } from '@main/mcp/registry';
import { McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { beforeEach, describe, expect, it } from 'vitest';

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
        modelCollaboration: {},
        rateLimit: { waitForToken: async () => undefined },
        auditLog: undefined
    } as never as McpDeps;
}

describe('MCP registry', () => {
    let services: McpService[];
    let serviceNames: Set<string>;

    beforeEach(() => {
        services = buildMcpServices(createMockDeps());
        serviceNames = new Set(services.map(s => s.name));
    });

    it('contains new specialized servers', () => {
        expect(serviceNames.has('docker')).toBe(true);
        expect(serviceNames.has('ssh')).toBe(true);
        expect(serviceNames.has('weather')).toBe(true);
    });

    describe('server builder registration', () => {
        it('should return a non-empty array of services', () => {
            expect(services.length).toBeGreaterThan(0);
        });

        it('should include core server categories', () => {
            expect(serviceNames.has('git')).toBe(true);
            expect(serviceNames.has('web')).toBe(true);
        });

        it('should have unique service names (no duplicates)', () => {
            const names = services.map(s => s.name);
            expect(new Set(names).size).toBe(names.length);
        });
    });

    describe('service structure', () => {
        it('every service should have a name and description', () => {
            for (const service of services) {
                expect(service.name).toBeTruthy();
                expect(typeof service.name).toBe('string');
                expect(typeof service.description).toBe('string');
            }
        });

        it('every service should have an actions array', () => {
            for (const service of services) {
                expect(Array.isArray(service.actions)).toBe(true);
            }
        });

        it('every action should have name, description, and handler', () => {
            for (const service of services) {
                for (const action of service.actions) {
                    expect(action.name).toBeTruthy();
                    expect(typeof action.name).toBe('string');
                    expect(typeof action.description).toBe('string');
                    expect(typeof action.handler).toBe('function');
                }
            }
        });

        it('action names within a service should be unique', () => {
            for (const service of services) {
                const actionNames = service.actions.map(a => a.name);
                expect(new Set(actionNames).size).toBe(actionNames.length);
            }
        });
    });

    describe('server lookup', () => {
        it('should find a service by name', () => {
            const gitService = services.find(s => s.name === 'git');
            expect(gitService).toBeDefined();
            expect(gitService?.name).toBe('git');
        });

        it('should return undefined for nonexistent service name', () => {
            const missing = services.find(s => s.name === 'nonexistent-service-xyz');
            expect(missing).toBeUndefined();
        });
    });

    describe('registry initialization', () => {
        it('should produce consistent results when called multiple times', () => {
            const deps = createMockDeps();
            const first = buildMcpServices(deps);
            const second = buildMcpServices(deps);
            expect(first.map(s => s.name)).toEqual(second.map(s => s.name));
        });
    });
});
