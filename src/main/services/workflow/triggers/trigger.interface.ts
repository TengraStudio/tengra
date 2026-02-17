import { JsonValue } from '@shared/types/common';
import { WorkflowTrigger } from '@shared/types/workflow.types';

export interface IWorkflowTriggerHandler {
    type: string;
    register(trigger: WorkflowTrigger, callback: (context?: JsonValue) => void): void;
    unregister(trigger: WorkflowTrigger): void;
}
