import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { registerSessionAutomationHandlers } from '@main/ipc/session-automation.handlers';
import { AutomationWorkflowService } from '@main/services/workspace/automation-workflow.service';
import { BrowserWindow } from 'electron';

export function registerSessionAutomationIpc(
    automationWorkflowService: AutomationWorkflowService,
    getMainWindow: () => BrowserWindow | null
): void {
    const validateSender = createMainWindowSenderValidator(
        getMainWindow,
        'session automation operation'
    );

    registerSessionAutomationHandlers({
        automationWorkflowService,
        validateSender,
    });
}
