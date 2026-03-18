import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import { promisify } from 'util';

import { BaseService } from '@main/services/base.service';
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
        OLLAMA_NOT_INSTALLED: 'images.runtimeHealth.ollama.notInstalled',
        OLLAMA_NOT_RUNNING: 'images.runtimeHealth.ollama.notRunning',
        OLLAMA_RUNNING: 'images.runtimeHealth.ollama.running',
        NO_PROBE: 'images.runtimeHealth.noProbe',
    } as const;

    constructor() {
        super('ExternalRuntimeDependencyService');
    }

    async assess(componentId: string): Promise<ExternalDependencyAssessment> {
        if (componentId === 'ollama') {
            return this.assessOllama();
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
                message: 'Ollama is not installed',
                messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.OLLAMA_NOT_INSTALLED,
            };
        }

        if (!running) {
            return {
                detected: true,
                running: false,
                action: 'start',
                message: 'Ollama is installed but not running',
                messageKey: ExternalRuntimeDependencyService.MESSAGE_KEY.OLLAMA_NOT_RUNNING,
            };
        }

        return {
            detected: true,
            running: true,
            action: 'none',
            message: 'Ollama is installed and running',
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

    private async isOllamaRunning(): Promise<boolean> {
        try {
            const response = await fetch(`${NETWORK_DEFAULTS.OLLAMA_BASE_URL}/api/tags`);
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
