/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import { BaseService } from '@main/services/base.service';
import { t } from '@main/utils/i18n.util';
import { NETWORK_DEFAULTS } from '@shared/constants/app-config';
import { RuntimeHealthAction } from '@shared/types/runtime-manifest';

const execFileAsync = promisify(execFile);

interface ExternalDependencyAssessment {
    detected: boolean;
    running: boolean;
    action: RuntimeHealthAction;
    message: string;
    messageKey?: string;
    messageParams?: Record<string, string | number>;
}

export class ExternalRuntimeDependencyService extends BaseService {
    private static readonly MESSAGE_KEY = {
        OLLAMA_NOT_INSTALLED: 'runtime.health.ollama.notInstalled',
        OLLAMA_NOT_RUNNING: 'runtime.health.ollama.notRunning',
        OLLAMA_RUNNING: 'runtime.health.ollama.running',
        NO_PROBE: 'runtime.health.noProbe',
    } as const;

    constructor() {
        super('ExternalRuntimeDependencyService');
    }

    async assess(componentId: string): Promise<ExternalDependencyAssessment> {
        if (componentId === 'ollama') {
            return this.assessOllama();
        }
        if (componentId === 'sd-cpp') {
            return this.assessSdCpp();
        }
        if (componentId === 'ghostty' || componentId === 'alacritty' || componentId === 'warp' || componentId === 'kitty') {
            return this.assessExecutableComponent(componentId);
        }

        return {
            detected: false,
            running: false,
            action: 'install',
            message: `No external dependency probe is registered for ${componentId}`,
            messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.NO_PROBE,
            messageParams: { componentId },
        };
    }

    private async assessOllama(): Promise<ExternalDependencyAssessment> {
        const [detected, running] = await Promise.all([
            this.isOllamaInstalled(),
            this.isOllamaRunning(),
        ]);

        if (!detected) {
            return {
                detected: false,
                running: false,
                action: 'install',
                message: t('backend.ollamaIsNotInstalled'),
                messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.OLLAMA_NOT_INSTALLED,
            };
        }

        if (!running) {
            return {
                detected: true,
                running: false,
                action: 'start',
                message: t('backend.ollamaIsInstalledButNotRunning'),
                messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.OLLAMA_NOT_RUNNING,
            };
        }

        return {
            detected: true,
            running: true,
            action: 'none',
            message: t('backend.ollamaIsInstalledAndRunning'),
            messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.OLLAMA_RUNNING,
        };
    }

    private async isOllamaInstalled(): Promise<boolean> {
        const executableName = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
        const candidates = this.getOllamaCandidatePaths(executableName);

        for (const candidate of candidates) {
            if (await this.pathExists(candidate)) {
                return true;
            }
        }

        return this.commandExists(executableName);
    }

    private async assessSdCpp(): Promise<ExternalDependencyAssessment> {
        const executableCandidates = this.getSdCppCandidatePaths();
        for (const candidate of executableCandidates) {
            if (await this.pathExists(candidate)) {
                return {
                    detected: true,
                    running: false,
                    action: 'none',
                    message: t('backend.stableDiffusionCppRuntimeIsInstalled'),
                };
            }
        }

        return {
            detected: false,
            running: false,
            action: 'install',
            message: t('backend.stableDiffusionCppRuntimeIsNotInstalled'),
        };
    }

    private async assessExecutableComponent(componentId: string): Promise<ExternalDependencyAssessment> {
        const installed = await this.isExecutableComponentInstalled(componentId);
        if (!installed) {
            return {
                detected: false,
                running: false,
                action: 'install',
                message: `${componentId} is not installed`,
            };
        }

        return {
            detected: true,
            running: false,
            action: 'none',
            message: `${componentId} is installed`,
        };
    }

    private async isExecutableComponentInstalled(componentId: string): Promise<boolean> {
        const executableName = process.platform === 'win32' ? `${componentId}.exe` : componentId;
        const candidates = this.getExecutableCandidatePaths(componentId, executableName);
        for (const candidate of candidates) {
            if (await this.pathExists(candidate)) {
                return true;
            }
        }

        return this.commandExists(executableName);
    }

    private getExecutableCandidatePaths(componentId: string, executableName: string): string[] {
        const candidates = new Set<string>();
        if (process.platform === 'win32') {
            const localAppData = process.env['LOCALAPPDATA'] ?? '';
            const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
            if (componentId === 'ghostty') {
                candidates.add(path.join(programFiles, 'Ghostty', 'ghostty.exe'));
                candidates.add(path.join(localAppData, 'Ghostty', 'ghostty.exe'));
            } else if (componentId === 'alacritty') {
                candidates.add(path.join(programFiles, 'Alacritty', 'alacritty.exe'));
                candidates.add(path.join(localAppData, 'Alacritty', 'alacritty.exe'));
            } else if (componentId === 'warp') {
                candidates.add(path.join(localAppData, 'Warp', 'warp.exe'));
                candidates.add(path.join(programFiles, 'Warp', 'warp.exe'));
            } else if (componentId === 'kitty') {
                candidates.add(path.join(programFiles, 'kitty', 'kitty.exe'));
                candidates.add(path.join(programFiles, 'Kitty', 'kitty.exe'));
                candidates.add(path.join(localAppData, 'Programs', 'kitty', 'kitty.exe'));
            }
        }
        candidates.add(executableName);
        return Array.from(candidates);
    }

    private getSdCppCandidatePaths(): string[] {
        const localAppData = process.env['LOCALAPPDATA'] ?? '';
        const executableName = process.platform === 'win32' ? 'sd.exe' : 'sd';
        return [
            path.join(localAppData, 'Programs', 'Tengra', 'runtime', 'bin', executableName),
            executableName,
        ];
    }

    private async isOllamaRunning(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(`${NETWORK_DEFAULTS.OLLAMA_BASE_URL}/api/tags`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    private getOllamaCandidatePaths(executableName: string): string[] {
        const candidates = new Set<string>();

        if (process.platform === 'win32') {
            const localAppData = process.env['LOCALAPPDATA'];
            if (localAppData) {
                candidates.add(`${localAppData}\\Programs\\Ollama\\ollama.exe`);
            }
        }

        if (process.platform === 'darwin') {
            candidates.add('/Applications/Ollama.app/Contents/MacOS/Ollama');
            candidates.add('/usr/local/bin/ollama');
            candidates.add('/opt/homebrew/bin/ollama');
        }

        if (process.platform === 'linux') {
            candidates.add('/usr/local/bin/ollama');
            candidates.add('/usr/bin/ollama');
            candidates.add('/snap/bin/ollama');
        }

        candidates.add(executableName);

        return Array.from(candidates);
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    private async commandExists(command: string): Promise<boolean> {
        const lookup = process.platform === 'win32' ? 'where' : 'which';

        try {
            await execFileAsync(lookup, [command], { windowsHide: true });
            return true;
        } catch {
            return false;
        }
    }
}

