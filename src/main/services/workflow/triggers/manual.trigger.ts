import { JsonValue } from '@shared/types/common';
import { WorkflowTrigger } from '@shared/types/workflow.types';

import { IWorkflowTriggerHandler } from './trigger.interface';

export class ManualTriggerHandler implements IWorkflowTriggerHandler {
    type: string = 'manual';
    private callbacks: Map<string, (context?: JsonValue) => void> = new Map();

    register(trigger: WorkflowTrigger, callback: (context?: JsonValue) => void): void {
        this.callbacks.set(trigger.id, callback);
    }

    unregister(trigger: WorkflowTrigger): void {
        this.callbacks.delete(trigger.id);
    }

    trigger(triggerId: string, context?: JsonValue): void {
        const callback = this.callbacks.get(triggerId);
        if (callback) {
            callback(context);
        }
    }
}
