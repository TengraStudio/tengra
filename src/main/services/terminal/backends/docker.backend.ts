/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { AuthService } from '@main/services/security/auth.service';

import { ProxyTerminalBackend } from './proxy-terminal.backend';
import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for Docker exec
 */
export class DockerBackend implements ITerminalBackend {
    public readonly id = 'docker';
    private proxyBackend: ProxyTerminalBackend;

    constructor(authService: AuthService) {
        this.proxyBackend = new ProxyTerminalBackend(authService);
    }

    /**
     * Check if Docker is available (delegates to proxy availability)
     */
    public async isAvailable(): Promise<boolean> {
        return this.proxyBackend.isAvailable();
    }

    /**
     * Create a new terminal session for Docker exec
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        const containerId = options.metadata?.containerId;
        if (typeof containerId !== 'string') {
            throw new Error('containerId (string) is required for Docker terminal');
        }

        const shell = (options.metadata?.shell as string) || '/bin/sh';
        appLogger.info('DockerBackend', `Executing in container ${containerId}: ${shell}`);

        // We use the proxy to run 'docker exec -it <id> <shell>'
        const dockerOptions: TerminalCreateOptions = {
            ...options,
            shell: 'docker',
            args: ['exec', '-it', containerId, shell],
            // Overriding env to ensure docker works as expected
            env: { ...options.env, TERM: 'xterm-256color' }
        };

        return this.proxyBackend.create(dockerOptions);
    }
}
