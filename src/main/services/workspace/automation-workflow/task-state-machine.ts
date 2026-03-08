import { WorkspaceStep, WorkspaceStepStatus } from '@shared/types/workspace-agent';

export class TaskStateMachine {
    getPendingDependencyIds(plan: WorkspaceStep[], index: number): string[] {
        const currentStep = plan[index];
        if (!currentStep) {
            return [];
        }
        const dependencyIds = currentStep.dependsOn ?? [];
        if (dependencyIds.length === 0) {
            return [];
        }
        const completedStepIds = new Set(plan.filter(step => step.status === 'completed').map(step => step.id));
        return dependencyIds.filter(stepId => !completedStepIds.has(stepId));
    }

    canRunStep(plan: WorkspaceStep[], index: number): boolean {
        return this.getPendingDependencyIds(plan, index).length === 0;
    }

    activateReadyDependentSteps(plan: WorkspaceStep[]): void {
        for (const step of plan) {
            if (step.status !== 'pending') {
                continue;
            }
            if (!step.timing) {
                step.timing = {};
            }
        }
    }

    startStep(plan: WorkspaceStep[], stepIndex: number): void {
        if (stepIndex < 0 || stepIndex >= plan.length) {
            return;
        }
        const step = plan[stepIndex];
        step.status = 'running';
        step.timing = { startedAt: Date.now() };
    }

    setStepStatus(plan: WorkspaceStep[], stepIndex: number, status: WorkspaceStepStatus): void {
        if (stepIndex < 0 || stepIndex >= plan.length) {
            return;
        }
        plan[stepIndex].status = status;
    }
}
