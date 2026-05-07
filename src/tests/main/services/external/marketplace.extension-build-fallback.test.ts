/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import os from 'os';
import path from 'path';

import { MarketplaceService } from '@main/services/external/marketplace.service';
import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => 'C:\\Users\\agnes\\AppData\\Roaming\\Tengra'),
    },
}));

interface MarketplaceServiceInternals {
    resolveExtensionEntrypointRelativePath: (packageJson: Record<string, unknown>) => string | null;
    resolveExtensionSourceEntrypointPath: (extensionPath: string, entrypointRelativePath: string) => Promise<string | null>;
    getExtensionInstallCommand: (packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun') => string;
    getExtensionBuildCommand: (packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun') => string;
    createExtensionBuildFailureError: (error: Error) => Error;
}

describe('MarketplaceService extension build fallback helpers', () => {
    const tempDirectories: string[] = [];

    afterEach(async () => {
        for (const directory of tempDirectories) {
            await fs.remove(directory);
        }
        tempDirectories.length = 0;
    });

    it('prefers tengra.main over other main declarations', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const entrypoint = internals.resolveExtensionEntrypointRelativePath({
            main: 'dist/package-main.js',
            manifest: { main: 'dist/manifest-main.js' },
            tengra: { main: 'dist/tengra-main.js' },
        });

        expect(entrypoint).toBe('dist/tengra-main.js');
    });

    it('falls back to manifest.main and package main when tengra.main is absent', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const manifestEntrypoint = internals.resolveExtensionEntrypointRelativePath({
            main: 'dist/package-main.js',
            manifest: { main: 'dist/manifest-main.js' },
        });
        const packageEntrypoint = internals.resolveExtensionEntrypointRelativePath({
            main: 'dist/package-main.js',
        });

        expect(manifestEntrypoint).toBe('dist/manifest-main.js');
        expect(packageEntrypoint).toBe('dist/package-main.js');
    });

    it('returns null when no main entrypoint is declared', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const entrypoint = internals.resolveExtensionEntrypointRelativePath({
            tengra: {},
            manifest: {},
        });

        expect(entrypoint).toBeNull();
    });

    it('resolves src entrypoint path from a dist main target', async () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const tempDirectory = path.join(
            os.tmpdir(),
            `tengra-marketplace-extension-${Date.now()}`
        );
        tempDirectories.push(tempDirectory);
        await fs.ensureDir(path.join(tempDirectory, 'src'));
        await fs.writeFile(path.join(tempDirectory, 'src', 'extension.ts'), 'export const activate = () => undefined;');

        const sourcePath = await internals.resolveExtensionSourceEntrypointPath(
            tempDirectory,
            'dist/extension.js'
        );

        expect(sourcePath).toBe(path.join(tempDirectory, 'src', 'extension.ts'));
    });

    it('maps install/build commands for all supported package managers', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        expect(internals.getExtensionInstallCommand('npm')).toBe('npm install --no-audit --no-fund');
        expect(internals.getExtensionInstallCommand('pnpm')).toBe('pnpm install');
        expect(internals.getExtensionInstallCommand('yarn')).toBe('yarn install');
        expect(internals.getExtensionInstallCommand('bun')).toBe('bun install');

        expect(internals.getExtensionBuildCommand('npm')).toBe('npm run build');
        expect(internals.getExtensionBuildCommand('pnpm')).toBe('pnpm run build');
        expect(internals.getExtensionBuildCommand('yarn')).toBe('yarn run build');
        expect(internals.getExtensionBuildCommand('bun')).toBe('bun run build');
    });

    it('converts alias/dependency JSX build errors into actionable guidance', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const converted = internals.createExtensionBuildFailureError(
            new Error("Extension command failed (npm run build): Cannot find module '@main/logging/logger'")
        );

        expect(converted.message).toContain('isolated marketplace environment');
        expect(converted.message).toContain('self-contained build setup');
    });

    it('keeps non-classified build errors unchanged', () => {
        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const original = new Error('Extension command failed: exit code 1');
        const converted = internals.createExtensionBuildFailureError(original);

        expect(converted).toBe(original);
    });
});

