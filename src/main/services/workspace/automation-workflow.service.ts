
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import { AgentPerformanceService } from '@main/services/workspace/automation-workflow/agent-performance.service';
import { AgentRegistryService } from '@main/services/workspace/automation-workflow/agent-registry.service';
import { AgentTemplateService } from '@main/services/workspace/automation-workflow/agent-template.service';
import { GitService } from '@main/services/workspace/git.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
    AgentProfile,
    AgentStartOptions,
    AgentTaskHistoryItem,
    AgentTeamworkAnalytics,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    AutomationWorkflowState,
    AutomationWorkflowStep,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    HelperCandidateScore,
    HelperHandoffPackage,
    HelperMergeGateDecision,
    ModelRoutingRule,
    RollbackCheckpointResult,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkerAvailabilityRecord,
} from '@shared/types/automation-workflow';

import { AgentCheckpointService } from './automation-workflow/agent-checkpoint.service';
import { AutomationWorkflowCollaborationManager } from './automation-workflow/automation-workflow-collaboration-manager';
import { AutomationWorkflowCouncilManager } from './automation-workflow/automation-workflow-council-manager';
import { AutomationWorkflowProfileManager } from './automation-workflow/automation-workflow-profile-manager';
import { AutomationWorkflowTaskManager } from './automation-workflow/automation-workflow-task-manager';
import { AutomationWorkflowTemplateManager } from './automation-workflow/automation-workflow-template-manager';
import { CouncilService } from './automation-workflow/council.service';

type WorkspaceState = AutomationWorkflowState;
type WorkspaceStep = AutomationWorkflowStep;

interface AutomationWorkflowServiceDependencies {
    databaseService: DatabaseService;
    llmService: LLMService;
    eventBus: EventBusService;
    agentRegistryService: AgentRegistryService;
    agentCheckpointService: AgentCheckpointService;
    gitService: GitService;
    agentCollaborationService: AgentCollaborationService;
    agentTemplateService: AgentTemplateService;
    agentPerformanceService: AgentPerformanceService;
    councilService: CouncilService;
}

export class AutomationWorkflowService extends BaseService {
    public readonly eventBus: EventBusService;

    private readonly profileManager: AutomationWorkflowProfileManager;
    private readonly templateManager: AutomationWorkflowTemplateManager;
    private readonly taskManager: AutomationWorkflowTaskManager;
    private readonly councilManager: AutomationWorkflowCouncilManager;

    constructor(deps: AutomationWorkflowServiceDependencies) {
        super('AutomationWorkflowService');
        this.eventBus = deps.eventBus;

        this.profileManager = new AutomationWorkflowProfileManager({
            registryService: deps.agentRegistryService
        });

        this.templateManager = new AutomationWorkflowTemplateManager({
            templateService: deps.agentTemplateService
        });

        const collaborationManager = new AutomationWorkflowCollaborationManager({
            databaseService: deps.databaseService,
            collaborationService: deps.agentCollaborationService
        });

        this.taskManager = new AutomationWorkflowTaskManager({
            databaseService: deps.databaseService,
            llmService: deps.llmService,
            eventBus: deps.eventBus,
            agentRegistryService: deps.agentRegistryService,
            agentCheckpointService: deps.agentCheckpointService,
            gitService: deps.gitService,
            agentCollaborationService: deps.agentCollaborationService,
            agentPerformanceService: deps.agentPerformanceService,
            councilService: deps.councilService,
            collaborationManager
        });

        this.councilManager = new AutomationWorkflowCouncilManager({
            databaseService: deps.databaseService,
            collaborationManager,
            taskManager: this.taskManager
        });
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.taskManager.setToolExecutor(toolExecutor);
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing AutomationWorkflowService...');
        await this.taskManager.initialize();
        this.logInfo('AutomationWorkflowService initialized');
    }

    override async cleanup(): Promise<void> {
        await this.taskManager.cleanup();
    }

    async dispose(): Promise<void> {
        await this.cleanup();
    }

    // --- Public API delegations ---

    public getCurrentTaskId(): string | null {
        return this.taskManager.getCurrentTaskId();
    }

    async start(options: AgentStartOptions): Promise<string> {
        return await this.taskManager.start(options);
    }

    async generatePlan(options: AgentStartOptions): Promise<void> {
        await this.taskManager.generatePlan(options);
    }

    async stop(taskId?: string): Promise<void> {
        await this.taskManager.stop(taskId);
    }

    async pauseTask(taskId?: string): Promise<void> {
        await this.taskManager.pauseTask(taskId);
    }

    async resumeTask(taskId: string): Promise<boolean> {
        return await this.taskManager.resumeTask(taskId);
    }

    async approvePlan(plan: WorkspaceStep[] | string[], taskId?: string): Promise<void> {
        await this.taskManager.approvePlan(plan, taskId);
    }

    async approveCurrentPlan(taskId: string): Promise<boolean> {
        return await this.taskManager.approveCurrentPlan(taskId);
    }

    async rejectCurrentPlan(taskId: string, reason?: string): Promise<boolean> {
        return await this.taskManager.rejectCurrentPlan(taskId, reason);
    }

    async getStatus(taskId?: string): Promise<WorkspaceState> {
        return await this.taskManager.getStatus(taskId);
    }

    async retryStep(index: number, taskId?: string): Promise<void> {
        await this.taskManager.retryStep(index, taskId);
    }

    // --- AGT-HIL: Human-in-the-Loop Step Methods ---

    async approveStep(taskId: string, stepId: string): Promise<void> {
        await this.taskManager.approveStep(taskId, stepId);
    }

    async skipStep(taskId: string, stepId: string): Promise<void> {
        await this.taskManager.skipStep(taskId, stepId);
    }

    async editStep(taskId: string, stepId: string, newText: string): Promise<void> {
        await this.taskManager.editStep(taskId, stepId, newText);
    }

    async addStepComment(taskId: string, stepId: string, comment: string): Promise<void> {
        await this.taskManager.addStepComment(taskId, stepId, comment);
    }

    async insertInterventionPoint(taskId: string, afterStepId: string): Promise<void> {
        await this.taskManager.insertInterventionPoint(taskId, afterStepId);
    }

    async resetState(taskId?: string): Promise<void> {
        await this.taskManager.resetState(taskId);
    }

    // --- History & Checkpoints wrappers ---

    async getTaskHistory(workspaceId: string): Promise<AgentTaskHistoryItem[]> {
        return await this.taskManager.getTaskHistory(workspaceId);
    }

    async getCheckpoints(taskId: string) {
        return await this.taskManager.getCheckpoints(taskId);
    }

    async getPlanVersions(taskId: string) {
        return await this.taskManager.getPlanVersions(taskId);
    }

    async resumeFromCheckpoint(checkpointId: string): Promise<void> {
        await this.taskManager.resumeFromCheckpoint(checkpointId);
    }

    async rollbackCheckpoint(checkpointId: string): Promise<RollbackCheckpointResult> {
        return await this.taskManager.rollbackCheckpoint(checkpointId);
    }

    async saveSnapshot(taskId: string): Promise<string> {
        return await this.taskManager.saveSnapshot(taskId);
    }

    async handleQuotaExhaustedInterrupt(input: {
        taskId: string;
        stageId?: string;
        provider: string;
        model: string;
        reason?: string;
        autoSwitch?: boolean;
    }) {
        return await this.councilManager.handleQuotaExhaustedInterrupt(input);
    }

    // --- Profile Management ---

    async getProfiles(): Promise<AgentProfile[]> {
        return await this.profileManager.getProfiles();
    }

    async registerProfile(profile: AgentProfile): Promise<AgentProfile> {
        return await this.profileManager.registerProfile(profile);
    }

    async deleteProfile(id: string): Promise<boolean> {
        return await this.profileManager.deleteProfile(id);
    }

    // --- Legacy / Misc ---

    async getAvailableModels() {
        return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        ];
    }

    async deleteTask(taskId: string): Promise<boolean> {
        return await this.taskManager.deleteTask(taskId);
    }

    async deleteTaskByNodeId(nodeId: string): Promise<boolean> {
        return await this.taskManager.deleteTaskByNodeId(nodeId);
    }

    async selectModel(taskId: string, provider: string, model: string): Promise<boolean> {
        return await this.taskManager.selectModel(taskId, provider, model);
    }

    // Stub methods for legacy compatibility that returns data
    async getTaskStatusDetails(taskId: string) {
        return await this.taskManager.getTaskStatusDetails(taskId);
    }

    async getTaskMessages(taskId: string) {
        return await this.taskManager.getTaskMessages(taskId);
    }

    async getTaskEvents(taskId: string) {
        return await this.taskManager.getTaskEvents(taskId);
    }

    async getTaskTelemetry(taskId: string) {
        return await this.taskManager.getTaskTelemetry(taskId);
    }

    async getPerformanceMetrics(taskId: string) {
        return await this.taskManager.getPerformanceMetrics(taskId);
    }

    async createPullRequest(taskId?: string): Promise<{ success: boolean; url?: string; error?: string }> {
        return await this.taskManager.createPullRequest(taskId);
    }

    // ===== AGT-COL: Collaboration Methods =====
    getRoutingRules(): ModelRoutingRule[] {
        return this.councilManager.getRoutingRules();
    }

    setRoutingRules(rules: ModelRoutingRule[]): void {
        this.councilManager.setRoutingRules(rules);
    }

    createVotingSession(
        taskId: string,
        stepIndex: number,
        question: string,
        options: string[]
    ): VotingSession {
        return this.councilManager.createVotingSession(taskId, stepIndex, question, options);
    }

    async submitVote(options: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }): Promise<VotingSession | null> {
        return await this.councilManager.submitVote(options);
    }

    async requestVotes(
        sessionId: string,
        models: Array<{ provider: string; model: string }>
    ): Promise<VotingSession | null> {
        return await this.councilManager.requestVotes(sessionId, models);
    }

    resolveVoting(sessionId: string): VotingSession | null {
        return this.councilManager.resolveVoting(sessionId);
    }

    getVotingSession(sessionId: string): VotingSession | null {
        return this.councilManager.getVotingSession(sessionId);
    }

    getVotingSessions(taskId?: string): VotingSession[] {
        return this.councilManager.getVotingSessions(taskId);
    }

    overrideVotingDecision(
        sessionId: string,
        finalDecision: string,
        reason?: string
    ): VotingSession | null {
        return this.councilManager.overrideVotingDecision(sessionId, finalDecision, reason);
    }

    getVotingAnalytics(taskId?: string): VotingAnalytics {
        return this.councilManager.getVotingAnalytics(taskId);
    }

    getVotingConfiguration(): VotingConfiguration {
        return this.councilManager.getVotingConfiguration();
    }

    updateVotingConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        return this.councilManager.updateVotingConfiguration(patch);
    }

    getVotingTemplates(): VotingTemplate[] {
        return this.councilManager.getVotingTemplates();
    }

    async buildConsensus(
        outputs: Array<{ modelId: string; provider: string; output: string }>
    ): Promise<ConsensusResult> {
        return await this.councilManager.buildConsensus(outputs);
    }

    createDebateSession(taskId: string, stepIndex: number, topic: string): DebateSession {
        return this.councilManager.createDebateSession(taskId, stepIndex, topic);
    }

    submitDebateArgument(options: {
        sessionId: string;
        agentId: string;
        provider: string;
        side: DebateSide;
        content: string;
        confidence: number;
        citations?: DebateCitation[];
    }): DebateSession | null {
        return this.councilManager.submitDebateArgument(options);
    }

    resolveDebateSession(sessionId: string): DebateSession | null {
        return this.councilManager.resolveDebateSession(sessionId);
    }

    overrideDebateSession(
        sessionId: string,
        moderatorId: string,
        decision: DebateSide | 'balanced',
        reason?: string
    ): DebateSession | null {
        return this.councilManager.overrideDebateSession(sessionId, moderatorId, decision, reason);
    }

    getDebateSession(sessionId: string): DebateSession | null {
        return this.councilManager.getDebateSession(sessionId);
    }

    getDebateHistory(taskId?: string): DebateSession[] {
        return this.councilManager.getDebateHistory(taskId);
    }

    getDebateReplay(sessionId: string): DebateReplay | null {
        return this.councilManager.getDebateReplay(sessionId);
    }

    generateDebateSummary(sessionId: string): string | null {
        return this.councilManager.generateDebateSummary(sessionId);
    }

    getTeamworkAnalytics(): AgentTeamworkAnalytics {
        return this.councilManager.getTeamworkAnalytics();
    }

    async sendCollaborationMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): Promise<AgentCollaborationMessage> {
        return await this.councilManager.sendCollaborationMessage(input);
    }

    registerWorkerAvailability(input: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }): WorkerAvailabilityRecord {
        return this.councilManager.registerWorkerAvailability(input);
    }

    listAvailableWorkers(taskId: string): WorkerAvailabilityRecord[] {
        return this.councilManager.listAvailableWorkers(taskId);
    }

    scoreHelperCandidates(input: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }): HelperCandidateScore[] {
        return this.councilManager.scoreHelperCandidates(input);
    }

    generateHelperHandoffPackage(input: {
        taskId: string;
        stageId: string;
        ownerAgentId: string;
        helperAgentId: string;
        stageGoal: string;
        acceptanceCriteria: string[];
        constraints: string[];
        contextNotes?: string;
    }): HelperHandoffPackage {
        return this.councilManager.generateHelperHandoffPackage(input);
    }

    reviewHelperMergeGate(input: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }): HelperMergeGateDecision {
        return this.councilManager.reviewHelperMergeGate(input);
    }

    async getCollaborationMessages(input: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): Promise<AgentCollaborationMessage[]> {
        return await this.councilManager.getCollaborationMessages(input);
    }

    async cleanupExpiredCollaborationMessages(taskId?: string): Promise<number> {
        return await this.councilManager.cleanupExpiredCollaborationMessages(taskId);
    }

    // ===== AGT-TPL: Template Methods =====
    getTemplates(): AgentTemplate[] {
        return this.templateManager.getTemplates();
    }

    getTemplatesByCategory(category: AgentTemplateCategory): AgentTemplate[] {
        return this.templateManager.getTemplatesByCategory(category);
    }

    async saveTemplate(template: AgentTemplate): Promise<{ success: boolean; template: AgentTemplate }> {
        return await this.templateManager.saveTemplate(template);
    }

    async deleteTemplate(id: string): Promise<boolean> {
        return await this.templateManager.deleteTemplate(id);
    }

    exportTemplate(id: string): AgentTemplateExport | null {
        return this.templateManager.exportTemplate(id);
    }

    async importTemplate(exported: AgentTemplateExport): Promise<AgentTemplate> {
        return await this.templateManager.importTemplate(exported);
    }

    applyTemplate(
        templateId: string,
        values: Record<string, string | number | boolean>
    ): { template: AgentTemplate; task: string; steps: string[] } {
        return this.templateManager.applyTemplate(templateId, values);
    }
}

