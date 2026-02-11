import { appLogger } from '@main/logging/logger';
import { SSHService } from '@main/services/project/ssh.service';

import { ITerminalBackend, ITerminalProcess, TerminalCreateOptions } from './terminal-backend.interface';

/**
 * Terminal backend implementation for SSH connections
 */
export class SSHBackend implements ITerminalBackend {
    public readonly id = 'ssh';

    constructor(private sshService: SSHService) { }

    /**
     * Check if SSH backend is available (always true if service exists)
     */
    public async isAvailable(): Promise<boolean> {
        return !!this.sshService;
    }

    /**
     * Create a new terminal session over SSH
     */
    public async create(options: TerminalCreateOptions): Promise<ITerminalProcess> {
        const connectionId = options.metadata?.connectionId;
        if (typeof connectionId !== 'string') {
            throw new Error('connectionId (string) is required for SSH terminal');
        }

        const isConnected = this.sshService.isConnected(connectionId);
        if (!isConnected) {
            throw new Error(`SSH connection ${connectionId} is not active`);
        }

        appLogger.info('SSHBackend', `Starting remote shell for connection ${connectionId}`);

        const result = await this.sshService.startShell(
            connectionId,
            (data) => options.onData(data),
            () => options.onExit(0)
        );

        if (!result.success) {
            throw new Error(`Failed to start SSH shell: ${result.error}`);
        }

        // Set initial rows/cols
        this.sshService.resizeShell(connectionId, options.cols, options.rows);

        return {
            write: (data: string) => {
                this.sshService.writeToShell(connectionId, data);
            },
            resize: (cols: number, rows: number) => {
                this.sshService.resizeShell(connectionId, cols, rows);
            },
            kill: () => {
                this.sshService.closeShell(connectionId);
            }
        };
    }
}
