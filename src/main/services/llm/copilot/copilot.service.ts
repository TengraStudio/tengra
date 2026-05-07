/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

