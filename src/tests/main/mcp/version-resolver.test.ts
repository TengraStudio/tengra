import { IMcpPlugin } from '@main/mcp/plugin-base';
import { McpDispatchResult } from '@main/mcp/types';
import { isVersionCompatible, resolvePluginDependencies } from '@main/mcp/version-resolver';
import { JsonObject } from '@shared/types/common';
import { describe, expect, it } from 'vitest';

function createMockPlugin(
    name: string,
    version?: string,
    dependencies?: Record<string, string>
): IMcpPlugin {
    return {
        name,
        description: `Mock plugin: ${name}`,
        source: 'core' as const,
        version,
        dependencies,
        initialize: async () => { /* noop */ },
        dispose: async () => { /* noop */ },
        getActions: async () => [],
        dispatch: async (_action: string, _args: JsonObject): Promise<McpDispatchResult> =>
            ({ success: true }),
        isAlive: () => true
    };
}

describe('version-resolver', () => {
    describe('isVersionCompatible', () => {
        describe('exact match (minor-compatible)', () => {
            it('should match exact same version', () => {
                expect(isVersionCompatible('1.2.3', '1.2.3')).toBe(true);
            });

            it('should match higher minor version with same major', () => {
                expect(isVersionCompatible('1.2.0', '1.3.0')).toBe(true);
            });

            it('should match higher patch version with same major.minor', () => {
                expect(isVersionCompatible('1.2.0', '1.2.5')).toBe(true);
            });

            it('should not match lower minor version', () => {
                expect(isVersionCompatible('1.3.0', '1.2.0')).toBe(false);
            });

            it('should not match different major version', () => {
                expect(isVersionCompatible('2.0.0', '1.9.9')).toBe(false);
            });

            it('should not match higher major version', () => {
                expect(isVersionCompatible('1.0.0', '2.0.0')).toBe(false);
            });
        });

        describe('>= range', () => {
            it('should match exact version with >= constraint', () => {
                expect(isVersionCompatible('>=1.0.0', '1.0.0')).toBe(true);
            });

            it('should match higher version with >= constraint', () => {
                expect(isVersionCompatible('>=1.0.0', '2.5.3')).toBe(true);
            });

            it('should not match lower version with >= constraint', () => {
                expect(isVersionCompatible('>=2.0.0', '1.9.9')).toBe(false);
            });

            it('should handle >= with spaces', () => {
                expect(isVersionCompatible('>= 1.0.0', '1.0.0')).toBe(true);
            });

            it('should match higher patch with >= constraint', () => {
                expect(isVersionCompatible('>=1.2.3', '1.2.4')).toBe(true);
            });

            it('should match higher minor with >= constraint', () => {
                expect(isVersionCompatible('>=1.2.0', '1.3.0')).toBe(true);
            });

            it('should not match lower patch with >= constraint', () => {
                expect(isVersionCompatible('>=1.2.3', '1.2.2')).toBe(false);
            });
        });

        describe('invalid version formats', () => {
            it('should return false for non-semver required', () => {
                expect(isVersionCompatible('abc', '1.0.0')).toBe(false);
            });

            it('should return false for non-semver actual', () => {
                expect(isVersionCompatible('1.0.0', 'abc')).toBe(false);
            });

            it('should return false for empty strings', () => {
                expect(isVersionCompatible('', '')).toBe(false);
            });

            it('should return false for partial version', () => {
                expect(isVersionCompatible('1.0', '1.0.0')).toBe(false);
            });

            it('should return false for both invalid', () => {
                expect(isVersionCompatible('not-a-version', 'also-not')).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle version 0.0.0', () => {
                expect(isVersionCompatible('0.0.0', '0.0.0')).toBe(true);
            });

            it('should handle large version numbers', () => {
                expect(isVersionCompatible('>=100.200.300', '100.200.300')).toBe(true);
            });

            it('should handle version with pre-release suffix (ignores suffix)', () => {
                // parseSemver extracts major.minor.patch from beginning
                expect(isVersionCompatible('1.0.0', '1.0.0-beta')).toBe(true);
            });
        });
    });

    describe('resolvePluginDependencies', () => {
        it('should return satisfied with no plugins', () => {
            const result = resolvePluginDependencies([]);
            expect(result.satisfied).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return satisfied for plugins without dependencies', () => {
            const plugins = [
                createMockPlugin('plugin-a', '1.0.0'),
                createMockPlugin('plugin-b', '2.0.0')
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should return satisfied when all dependencies are met', () => {
            const plugins = [
                createMockPlugin('core', '2.0.0'),
                createMockPlugin('extension', '1.0.0', { 'core': '>=1.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should detect missing dependencies', () => {
            const plugins = [
                createMockPlugin('extension', '1.0.0', { 'missing-plugin': '>=1.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('missing plugin');
            expect(result.errors[0]).toContain('missing-plugin');
        });

        it('should detect version incompatibility', () => {
            const plugins = [
                createMockPlugin('core', '1.0.0'),
                createMockPlugin('extension', '1.0.0', { 'core': '>=2.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('core');
            expect(result.errors[0]).toContain('>=2.0.0');
        });

        it('should default version to 0.0.0 for plugins without version', () => {
            const plugins = [
                createMockPlugin('core'), // no version → defaults to 0.0.0
                createMockPlugin('extension', '1.0.0', { 'core': '>=1.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(false);
            expect(result.errors).toHaveLength(1);
        });

        it('should report multiple errors for multiple unmet dependencies', () => {
            const plugins = [
                createMockPlugin('ext', '1.0.0', {
                    'dep-a': '>=1.0.0',
                    'dep-b': '>=2.0.0'
                })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(false);
            expect(result.errors).toHaveLength(2);
        });

        it('should handle circular-like dependencies correctly', () => {
            const plugins = [
                createMockPlugin('plugin-a', '1.0.0', { 'plugin-b': '1.0.0' }),
                createMockPlugin('plugin-b', '1.0.0', { 'plugin-a': '1.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(true);
        });

        it('should handle exact version matching for dependencies', () => {
            const plugins = [
                createMockPlugin('core', '1.5.0'),
                createMockPlugin('ext', '1.0.0', { 'core': '1.2.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            // exact match: same major, actual minor >= required minor
            expect(result.satisfied).toBe(true);
        });

        it('should fail exact version match with wrong major', () => {
            const plugins = [
                createMockPlugin('core', '2.0.0'),
                createMockPlugin('ext', '1.0.0', { 'core': '1.0.0' })
            ];
            const result = resolvePluginDependencies(plugins);
            expect(result.satisfied).toBe(false);
        });
    });
});
