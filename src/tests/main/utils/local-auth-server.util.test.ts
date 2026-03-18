import { LocalAuthServer } from '@main/utils/local-auth-server.util';
import { describe, expect, it } from 'vitest';

interface TokenDataForEmailExtraction {
    email?: string;
    access_token: string;
    expires_in: number;
    account?: {
        email_address?: string;
    };
    id_token?: string;
}

interface LocalAuthServerInternals {
    generateCodeVerifier: () => string;
    generateCodeChallenge: (verifier: string) => string;
    extractEmailFromTokenData: (tokenData: TokenDataForEmailExtraction) => string | undefined;
}

const localAuthServerInternals: LocalAuthServerInternals = {
    generateCodeVerifier: Reflect.get(LocalAuthServer, 'generateCodeVerifier') as LocalAuthServerInternals['generateCodeVerifier'],
    generateCodeChallenge: Reflect.get(LocalAuthServer, 'generateCodeChallenge') as LocalAuthServerInternals['generateCodeChallenge'],
    extractEmailFromTokenData: Reflect.get(LocalAuthServer, 'extractEmailFromTokenData') as LocalAuthServerInternals['extractEmailFromTokenData'],
};

describe('LocalAuthServer helpers', () => {
    it('generates URL-safe PKCE verifier and challenge', () => {
        const verifier = localAuthServerInternals.generateCodeVerifier();
        const challenge = localAuthServerInternals.generateCodeChallenge(verifier);

        expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
        expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
        expect(verifier.length).toBeGreaterThan(20);
        expect(challenge.length).toBeGreaterThan(20);
    });

    it('extractEmailFromTokenData extracts email from direct fields and ignores unverified id_token', () => {
        // Direct email
        const extracted1 = localAuthServerInternals.extractEmailFromTokenData({
            email: 'user@example.com',
            access_token: 'a',
            expires_in: 3600,
        });
        expect(extracted1).toBe('user@example.com');

        // Claude account email
        const extracted2 = localAuthServerInternals.extractEmailFromTokenData({
            account: { email_address: 'claude@example.com' },
            access_token: 'a',
            expires_in: 3600,
        });
        expect(extracted2).toBe('claude@example.com');

        // Ignored id_token
        const payload = Buffer.from(JSON.stringify({ email: 'fake@example.com' })).toString('base64url');
        const fakeJwt = `header.${payload}.sig`;
        const extracted3 = localAuthServerInternals.extractEmailFromTokenData({
            id_token: fakeJwt,
            access_token: 'a',
            expires_in: 3600,
        });
        expect(extracted3).toBeUndefined();
    });
});
