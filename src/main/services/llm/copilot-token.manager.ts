import { appLogger } from '@main/logging/logger';
import { AuthService } from '@main/services/security/auth.service';
import { getErrorMessage } from '@shared/utils/error.util';

import {
    CopilotAccountType,
    CopilotState,
    CopilotTokenResponse,
    CopilotUsageData,
    COPILOT_API_VERSION,
    COPILOT_EDITOR_PLUGIN_VERSION,
    COPILOT_USER_AGENT,
    GITHUB_COPILOT_USER_URL,
    GITHUB_COPILOT_V1_TOKEN_URL,
    GITHUB_COPILOT_V2_TOKEN_URL
} from './copilot.types';

const SERVICE_NAME = 'CopilotTokenManager';

/**
 * Manages Copilot token acquisition, refresh, and persistence.
 */
export class CopilotTokenManager {
    constructor(
        private state: CopilotState,
        private authService?: AuthService
    ) {}

    /** Recovers tokens from AuthService when none are set */
    async recoverTokenFromAuthService(): Promise<void> {
        if (!this.authService) { return; }

        appLogger.info(SERVICE_NAME, 'No token set, attempting to recover from AuthService...');

        const copilotToken = await this.authService.getActiveToken('copilot_token');
        if (copilotToken) {
            this.state.copilotAuthToken = copilotToken;
            appLogger.info(SERVICE_NAME, `Recovered copilot_token (length: ${copilotToken.length})`);
        }

        const githubToken = await this.authService.getActiveToken('github_token');
        if (githubToken) {
            this.state.githubToken = githubToken;
            appLogger.info(SERVICE_NAME, `Recovered github_token (length: ${githubToken.length})`);
        } else {
            appLogger.info(SERVICE_NAME, 'github_token not found in AuthService');
        }

        appLogger.info(SERVICE_NAME, `Token recovery: Copilot=${!!this.state.copilotAuthToken}, GitHub=${!!this.state.githubToken}`);
    }

    /** Ensures a valid Copilot session token, refreshing if necessary */
    async ensureCopilotToken(): Promise<string> {
        if (this.state.copilotSessionToken && this.state.tokenExpiresAt > Date.now()) {
            return this.state.copilotSessionToken;
        }

        if (this.state.tokenPromise) {
            return this.state.tokenPromise;
        }

        this.state.tokenPromise = this.refreshToken();
        return this.state.tokenPromise;
    }

    /** Detects account type (individual/business/enterprise) */
    async detectAccountType(authHeaderToken: string): Promise<CopilotAccountType> {
        const usageRes = await fetch(GITHUB_COPILOT_USER_URL, {
            headers: {
                'Authorization': `token ${authHeaderToken}`,
                'Accept': 'application/json',
                'User-Agent': COPILOT_USER_AGENT
            }
        });
        if (usageRes.ok) {
            const usageData = await usageRes.json() as CopilotUsageData;
            this.state.accountType = usageData.copilot_plan ?? 'individual';
            appLogger.info(SERVICE_NAME, `Detected Plan: ${this.state.accountType}`);
        }
        return this.state.accountType;
    }

    /** Handles 401/404 token errors by clearing invalid tokens */
    handleAuthStatusError(status: number, authHeaderToken: string): void {
        if (status === 401) {
            appLogger.warn(SERVICE_NAME, 'Token unauthorized (401). Clearing token.');
            if (authHeaderToken === this.state.copilotAuthToken) {
                this.state.copilotAuthToken = null;
            } else {
                this.state.githubToken = null;
            }
            this.state.copilotSessionToken = null;
            if (this.authService) {
                void this.authService.unlinkAllForProvider('copilot_token');
            }
        } else if (status === 404) {
            appLogger.error(SERVICE_NAME, 'Token not found (404). Please re-login.');
        }
    }

    private async refreshToken(): Promise<string> {
        try {
            return await this.doRefreshToken();
        } finally {
            this.state.tokenPromise = null;
        }
    }

    private async doRefreshToken(): Promise<string> {
        // Try proactive session token from AuthService
        if (this.authService) {
            const account = await this.authService.getActiveAccountFull('copilot');
            if (account?.sessionToken && account?.expiresAt && account.expiresAt > Date.now()) {
                appLogger.info(SERVICE_NAME, 'Using proactive session token from AuthService');
                this.state.copilotSessionToken = account.sessionToken;
                this.state.tokenExpiresAt = account.expiresAt;
                return this.state.copilotSessionToken;
            }
        }

        if (!this.state.copilotAuthToken) {
            await this.recoverTokenFromAuthService();
        }

        const authHeaderToken = this.state.copilotAuthToken ?? this.state.githubToken;
        if (!authHeaderToken) {
            throw new Error('Copilot Authentication failed: No copilot_token or github_token found. Please login via Settings.');
        }

        appLogger.info(SERVICE_NAME, `Using ${this.state.copilotAuthToken ? 'copilot_token' : 'github_token'} for auth`);

        try {
            await this.detectAccountType(authHeaderToken);
        } catch (error) {
            appLogger.warn(SERVICE_NAME, `Failed to detect account type: ${getErrorMessage(error)}`);
        }

        return await this.fetchAndPersistToken(authHeaderToken);
    }

    private async fetchAndPersistToken(authHeaderToken: string): Promise<string> {
        const response = await this.fetchV2Token(authHeaderToken);

        if (!response.ok) {
            return await this.handleTokenFetchFailure(response, authHeaderToken);
        }

        const data = await response.json() as CopilotTokenResponse;
        this.state.copilotSessionToken = data.token;
        this.state.tokenExpiresAt = (data.expires_at ?? (Date.now() / 1000 + 1200)) * 1000;

        await this.persistToAuthService(authHeaderToken);
        return this.state.copilotSessionToken;
    }

    private async fetchV2Token(authHeaderToken: string): Promise<Response> {
        return await fetch(GITHUB_COPILOT_V2_TOKEN_URL, {
            headers: {
                'Authorization': `token ${authHeaderToken}`,
                'Accept': 'application/json',
                'Editor-Version': `vscode/${this.state.vsCodeVersion}`,
                'Editor-Plugin-Version': COPILOT_EDITOR_PLUGIN_VERSION,
                'User-Agent': COPILOT_USER_AGENT,
                'X-GitHub-Api-Version': COPILOT_API_VERSION,
            }
        });
    }

    private async handleTokenFetchFailure(response: Response, authHeaderToken: string): Promise<string> {
        if (response.status === 404) {
            appLogger.warn(SERVICE_NAME, 'v2/token 404, attempting fallback to v1/token');
            const v1Result = await this.tryV1Fallback(authHeaderToken);
            if (v1Result) { return v1Result; }
        }

        const errorText = await response.text();
        this.handleAuthStatusError(response.status, authHeaderToken);
        throw new Error(`Failed to get Copilot token: ${response.status} ${errorText}`);
    }

    private async tryV1Fallback(authHeaderToken: string): Promise<string | null> {
        const v1Response = await fetch(GITHUB_COPILOT_V1_TOKEN_URL, {
            headers: {
                'Authorization': `token ${authHeaderToken}`,
                'Accept': 'application/json',
                'Editor-Version': `vscode/${this.state.vsCodeVersion}`,
                'Editor-Plugin-Version': COPILOT_EDITOR_PLUGIN_VERSION,
                'User-Agent': COPILOT_USER_AGENT,
                'X-GitHub-Api-Version': COPILOT_API_VERSION
            }
        });

        if (v1Response.ok) {
            const data = await v1Response.json() as CopilotTokenResponse;
            this.state.copilotSessionToken = data.token;
            this.state.tokenExpiresAt = (data.expires_at ?? (Date.now() / 1000 + 1200)) * 1000;
            return this.state.copilotSessionToken;
        }

        const v1ErrorText = await v1Response.text();
        appLogger.error(SERVICE_NAME, `v1 fallback failed: ${v1Response.status} ${v1ErrorText}`);
        if (v1Response.status === 404) {
            appLogger.error(SERVICE_NAME, 'Token appears invalid (404 on both endpoints). Please re-login.');
        }
        return null;
    }

    private async persistToAuthService(authHeaderToken: string): Promise<void> {
        if (!this.authService) { return; }
        try {
            await this.authService.linkAccount('copilot', {
                accessToken: authHeaderToken,
                sessionToken: this.state.copilotSessionToken!,
                expiresAt: this.state.tokenExpiresAt,
                metadata: { plan: this.state.accountType }
            });
            appLogger.info(SERVICE_NAME, 'Persisted Copilot session token to AuthService');
        } catch (err) {
            appLogger.warn(SERVICE_NAME, `Failed to persist Copilot token: ${getErrorMessage(err)}`);
        }
    }
}
