import { describe, expect, it, vi } from 'vitest';

import { McpDeps } from '@/../main/mcp/server-utils';
import { buildSecurityServers } from '@/../main/mcp/servers/security.server';
import { quoteShellArg } from '@/../shared/utils/sanitize.util';

describe('Security Fixes Verification (SEC-001)', () => {

    describe('quoteShellArg', () => {
        it('should wrap simple strings in single quotes', () => {
            expect(quoteShellArg('foo')).toBe("'foo'");
        });

        it('should escape single quotes', () => {
            // "foo'bar" -> "'foo''bar'" (PowerShell style)
            expect(quoteShellArg("foo'bar")).toBe("'foo''bar'");
        });

        it('should handle spaces correctly', () => {
            expect(quoteShellArg('foo bar')).toBe("'foo bar'");
        });

        it('should handle empty strings', () => {
            expect(quoteShellArg('')).toBe("''");
        });
    });

    describe('Security Server - Port Validation', () => {
        const mockDeps = {
            command: { executeCommand: vi.fn() } as any,
            security: {} as any,
            system: {} as any,
            settings: { getSettings: () => ({ mcpSecurityAllowedHosts: ['example.com'] }) } as any
        } as unknown as McpDeps;

        const securityServer = buildSecurityServers(mockDeps).find(s => s.name === 'security-audit');
        const portScanAction = securityServer?.actions.find(a => a.name === 'portScan');

        it('should accept valid port lists', async () => {
            const validPorts = ['80', '80,443', '1-1000', '80,443,8080-8090'];

            for (const ports of validPorts) {
                await expect(portScanAction?.handler({ target: 'example.com', ports })).resolves.not.toThrow();
            }
        });

        it('should reject invalid chars in ports', async () => {
            const invalidPorts = [
                '80; rm -rf /',
                '80 && echo hack',
                '80 | bash',
                '$(whoami)'
            ];

            for (const ports of invalidPorts) {
                const result = await portScanAction?.handler({ target: 'example.com', ports });
                expect(result).toEqual(expect.objectContaining({
                    success: false,
                    error: expect.stringContaining('Invalid ports')
                }));
            }
        });

        it('should reject empty or whitespace ports', async () => {
            // If ports is passed but is just noise?
            const result1 = await portScanAction?.handler({ target: 'example.com', ports: ' ' });
            expect(result1).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Invalid ports') }));

            const result2 = await portScanAction?.handler({ target: 'example.com', ports: 'abc' });
            expect(result2).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Invalid ports') }));
        });
    });
});
