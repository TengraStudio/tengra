import { BaseService } from '@main/services/base.service';

export class CopilotService extends BaseService {
    private githubToken: string | null = null;
    private copilotToken: string | null = null;

    constructor() {
        super('CopilotService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Copilot compatibility shim...');
    }

    async cleanup(): Promise<void> {
        this.githubToken = null;
        this.copilotToken = null;
        this.logInfo('Copilot compatibility shim cleanup complete');
    }

    public setGithubToken(token: string): void {
        this.githubToken = token.trim().length > 0 ? token : null;
    }

    public setCopilotToken(token: string): void {
        this.copilotToken = token.trim().length > 0 ? token : null;
    }

    public isConfigured(): boolean {
        return this.githubToken !== null || this.copilotToken !== null;
    }
}
