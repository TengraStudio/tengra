import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import {
    AGENT_COLLABORATION_PERFORMANCE_BUDGETS,
    AgentCollaborationTelemetryEvent,
    ConsensusResult,
} from '@shared/types/project-agent';

export interface ConsensusDependencies {
    llm: LLMService;
    telemetry?: TelemetryService;
}

/**
 * AgentConsensusService
 * Extracted from AgentCollaborationService to handle output consensus and arbitration.
 * AI-SYS-14 refactor.
 */
export class AgentConsensusService extends BaseService {
    constructor(private deps: ConsensusDependencies) {
        super('AgentConsensusService');
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(telemetry: TelemetryService): void {
        this.deps.telemetry = telemetry;
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Consensus Service...');
    }

    async buildConsensus(outputs: Array<{ model: string; output: string }>): Promise<ConsensusResult> {
        const startMs = Date.now();
        if (outputs.length === 0) {
            return { agreed: false, resolutionMethod: 'manual' };
        }
        if (outputs.length === 1) {
            return {
                agreed: true,
                mergedOutput: outputs[0].output,
                resolutionMethod: 'unanimous',
            };
        }

        // Simple similarity check
        const similarities = this.calculateSimilarities(outputs);

        if (similarities.every(s => s > 0.8)) {
            this.track(AgentCollaborationTelemetryEvent.CONSENSUS_REACHED, {
                modelCount: outputs.length,
                resolutionMethod: 'unanimous'
            });
            return {
                agreed: true,
                mergedOutput: outputs[0].output,
                resolutionMethod: 'unanimous',
            };
        }

        const majorityOutput = this.findMajorityOutput(outputs);
        if (majorityOutput) {
            this.track(AgentCollaborationTelemetryEvent.CONSENSUS_REACHED, {
                modelCount: outputs.length,
                resolutionMethod: 'majority'
            });
            return {
                agreed: true,
                mergedOutput: majorityOutput,
                resolutionMethod: 'majority',
            };
        }

        const conflictingPoints = this.identifyConflicts(outputs);
        this.track(AgentCollaborationTelemetryEvent.CONFLICT_DETECTED, {
            conflictType: 'output_disagreement',
            modelCount: outputs.length
        });

        // Try to merge using an arbitrator model
        const mergedOutput = await this.arbitrate(outputs);
        if (mergedOutput) {
            this.track(AgentCollaborationTelemetryEvent.RESULT_MERGED, {
                modelCount: outputs.length,
                resolutionMethod: 'arbitration'
            });
            this.warnIfOverBudget('buildConsensus', startMs, AGENT_COLLABORATION_PERFORMANCE_BUDGETS.BUILD_CONSENSUS_MS);
            return {
                agreed: true,
                mergedOutput,
                conflictingPoints,
                resolutionMethod: 'arbitration',
            };
        }

        this.track(AgentCollaborationTelemetryEvent.CONSENSUS_FAILED, {
            modelCount: outputs.length,
            resolutionMethod: 'manual'
        });
        this.warnIfOverBudget('buildConsensus', startMs, AGENT_COLLABORATION_PERFORMANCE_BUDGETS.BUILD_CONSENSUS_MS);
        return {
            agreed: false,
            conflictingPoints,
            resolutionMethod: 'manual',
        };
    }

    private calculateSimilarities(outputs: Array<{ model: string; output: string }>): number[] {
        if (outputs.length <= 1) { return [1]; }
        const base = outputs[0].output;
        return outputs.slice(1).map(o => this.calculateSimilarity(base, o.output));
    }

    private calculateSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);
        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    private findMajorityOutput(outputs: Array<{ model: string; output: string }>): string | null {
        const threshold = 0.5;
        for (let i = 0; i < outputs.length; i++) {
            let matches = 1;
            for (let j = 0; j < outputs.length; j++) {
                if (i === j) { continue; }
                if (this.calculateSimilarity(outputs[i].output, outputs[j].output) > 0.85) {
                    matches++;
                }
            }
            if (matches / outputs.length > threshold) {
                return outputs[i].output;
            }
        }
        return null;
    }

    private identifyConflicts(outputs: Array<{ model: string; output: string }>): ConsensusResult['conflictingPoints'] {
        // Simple conflict identification (line based)
        const allLines = outputs.flatMap(o => o.output.split('\n'));
        const uniqueLines = new Set(allLines);
        const conflicts: ConsensusResult['conflictingPoints'] = [];
        if (uniqueLines.size > outputs[0].output.split('\n').length + 10) {
            conflicts.push({
                topic: 'Content Disagreement',
                outputs: outputs.map(o => ({ modelId: o.model, output: o.output }))
            });
        }
        return conflicts;
    }

    private async arbitrate(outputs: Array<{ model: string; output: string }>): Promise<string | null> {
        const prompt = `You are an arbitrator. Multiple AI models have produced conflicting outputs for the same task. Your job is to analyze the outputs and produce a single, merged, best version that captures the consensus and resolves disagreements logically.
        
        Outputs:
        ${outputs.map((o, i) => `--- Model ${i + 1} (${o.model}) ---\n${o.output}\n`).join('\n')}
        
        Final Merged Output:`;

        try {
            const response = await this.deps.llm.chat(
                [{ id: 'arbitrator', role: 'user', content: prompt, timestamp: new Date() }],
                'gpt-4o', // Best model for arbitration
                [],
                'openai'
            );
            return typeof response.content === 'string' ? response.content : null;
        } catch (error) {
            this.logError('Arbitration failed', error as Error);
            return null;
        }
    }

    private track(event: AgentCollaborationTelemetryEvent, payload: Record<string, unknown>): void {
        if (this.deps.telemetry) {
            this.deps.telemetry.track(event, payload);
        }
    }

    private warnIfOverBudget(operation: string, startMs: number, budgetMs: number): void {
        const duration = Date.now() - startMs;
        if (duration > budgetMs) {
            this.logWarn(`Performance budget exceeded for ${operation}: ${duration}ms (budget: ${budgetMs}ms)`);
        }
    }

    override async cleanup(): Promise<void> {
        // No persistent state
    }
}
