import { CatchError } from '@shared/types/common'

export interface AuthResult {
    url: string
    state: string
}

export interface AuthTokenData {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type?: string
    scope?: string
}

export interface AuthCallbackData extends AuthTokenData {
    email?: string
    type?: string
    project_id?: string
}

export class LocalAuthServer {
    // private static ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com'
    // private static ANTIGRAVITY_CLIENT_SECRET = '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'

    /**
     * Starts the Antigravity OAuth flow.
     */
    static async startAntigravityAuth(
        _onSuccess: (data: AuthCallbackData) => void,
        onError: (err: CatchError) => void
    ): Promise<AuthResult> {
        console.warn('[LocalAuthServer] Antigravity Auth is disabled.')
        const err = new Error('Antigravity support has been removed.')
        onError(err)
        return Promise.reject(err)
    }
}
