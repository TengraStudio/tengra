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
