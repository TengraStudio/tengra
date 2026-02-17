import { exec } from 'child_process';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { JsonValue } from '@shared/types/common';
import { WorkflowAction } from '@shared/types/workflow.types';
import { WorkflowContext } from '@shared/types/workflow-context.types';

import { IWorkflowActionHandler } from './action.interface';

const execAsync = promisify(exec);

export class CommandActionHandler implements IWorkflowActionHandler {
    type: string = 'command';

    async execute(action: WorkflowAction, _context?: WorkflowContext): Promise<JsonValue> {
        const command = action.config['command'];
        if (typeof command !== 'string') {
            throw new Error('Command action requires a "command" string in config');
        }

        try {
            const { stdout, stderr } = await execAsync(command);
            if (stderr) {
                appLogger.error('CommandActionHandler', `Command stderr: ${stderr}`);
            }
            if (stdout) {
                appLogger.info('CommandActionHandler', `Command stdout: ${stdout}`);
            }
            return { stdout, stderr };
        } catch (error) {
            throw new Error(`Command execution failed: ${error}`);
        }
    }
}
