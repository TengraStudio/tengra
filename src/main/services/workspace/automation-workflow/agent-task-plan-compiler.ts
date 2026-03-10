import { randomUUID } from 'crypto';

import { WorkspaceStep } from '@shared/types/automation-workflow';
import { JsonValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';

type StepType = 'task' | 'fork' | 'join';
type StepPriority = 'low' | 'normal' | 'high' | 'critical';

export class AgentTaskPlanCompiler {
    parseJsonPlan(content: string): string[] | null {
        const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();

        const jsonPatterns = [
            /\{[\s\S]*"steps"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
            /\{[\s\S]*"plan"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
            /\[[\s\S]*\]/,
        ];

        for (const pattern of jsonPatterns) {
            const match = jsonContent.match(pattern) ?? content.match(pattern);
            if (!match) {
                continue;
            }

            const parsed = safeJsonParse<JsonValue | null>(match[0], null);
            const steps = this.extractStepsFromParsed(parsed);
            if (steps) {
                return steps;
            }
        }

        return null;
    }

    normalizePlan(plan: WorkspaceStep[] | string[]): WorkspaceStep[] {
        if (plan.length === 0) {
            return [];
        }

        if (this.isStringPlan(plan)) {
            const generated = plan.map(text => {
                const inferredType = this.inferStepType(text);
                return {
                    id: randomUUID(),
                    text,
                    status: 'pending' as const,
                    type: inferredType,
                    dependsOn: [],
                    priority: this.getPriorityForStep(text),
                    parallelLane: 0,
                };
            });

            return this.buildDependenciesAndLanes(generated);
        }

        const normalized = plan.map(step => ({
            id: step.id || randomUUID(),
            text: step.text,
            status: step.status,
            type: step.type ?? this.inferStepType(step.text),
            dependsOn: step.dependsOn ?? [],
            priority: step.priority ?? this.getPriorityForStep(step.text),
            parallelLane: step.parallelLane,
            branchId: step.branchId,
        }));

        return this.buildDependenciesAndLanes(normalized);
    }

    private isStringPlan(plan: WorkspaceStep[] | string[]): plan is string[] {
        return plan.every(step => typeof step === 'string');
    }

    private extractStepsFromParsed(parsed: JsonValue | null): string[] | null {
        if (Array.isArray(parsed)) {
            return this.arrayToSteps(parsed);
        }
        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }

        const stepsArray = parsed['steps'] ?? parsed['plan'];
        if (!Array.isArray(stepsArray)) {
            return null;
        }

        return this.arrayToSteps(stepsArray);
    }

    private arrayToSteps(values: JsonValue[]): string[] | null {
        if (values.length === 0) {
            return null;
        }

        const steps = values
            .map(value => {
                if (typeof value === 'string') {
                    return value;
                }
                if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'text' in value) {
                    return String(value['text']);
                }
                return String(value);
            })
            .filter(value => value.length > 0);

        return steps.length > 0 ? steps : null;
    }

    private inferStepType(text: string): StepType {
        const normalized = text.trim().toLowerCase();
        if (normalized.startsWith('fork:') || normalized.startsWith('[fork]')) {
            return 'fork';
        }
        if (normalized.startsWith('join:') || normalized.startsWith('[join]')) {
            return 'join';
        }
        return 'task';
    }

    private getPriorityForStep(text: string): StepPriority {
        const normalized = text.toLowerCase();
        if (normalized.includes('[critical]')) {
            return 'critical';
        }
        if (normalized.includes('[high]')) {
            return 'high';
        }
        if (normalized.includes('[low]')) {
            return 'low';
        }
        return 'normal';
    }

    private buildDependenciesAndLanes(steps: WorkspaceStep[]): WorkspaceStep[] {
        if (steps.length === 0) {
            return [];
        }

        const normalizedSteps: WorkspaceStep[] = [];
        const laneByBranch = new Map<string, number>();
        let nextLane = 0;

        for (let index = 0; index < steps.length; index += 1) {
            const step = steps[index];
            const previous = normalizedSteps[index - 1];
            const branchId = step.branchId ?? `branch-${index}`;

            if (!laneByBranch.has(branchId)) {
                laneByBranch.set(branchId, nextLane);
                nextLane += 1;
            }

            let dependsOn = step.dependsOn ?? [];
            if (dependsOn.length === 0 && previous && step.type !== 'fork') {
                dependsOn = [previous.id];
            }

            if (step.type === 'join') {
                const pendingJoinDependencies = normalizedSteps
                    .filter(candidate => candidate.type !== 'join')
                    .map(candidate => candidate.id);
                if (pendingJoinDependencies.length > 0) {
                    dependsOn = pendingJoinDependencies;
                }
            }

            normalizedSteps.push({
                ...step,
                dependsOn,
                parallelLane: step.parallelLane ?? laneByBranch.get(branchId) ?? 0,
                branchId,
            });
        }

        return normalizedSteps;
    }
}

