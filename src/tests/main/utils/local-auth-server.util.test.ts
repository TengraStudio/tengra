import { LocalAuthServer } from '@main/utils/local-auth-server.util';
import { describe, expect, it } from 'vitest';

describe('LocalAuthServer helpers', () => {
    it('generates URL-safe PKCE verifier and challenge', () => {
        const verifier = (LocalAuthServer as any).generateCodeVerifier() as string;
        const challenge = (LocalAuthServer as any).generateCodeChallenge(verifier) as string;

        expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
        expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
        expect(verifier.length).toBeGreaterThan(20);
        expect(challenge.length).toBeGreaterThan(20);
    });

    it('decodes JWT payload and extracts email', () => {
        const payload = Buffer.from(JSON.stringify({ email: 'user@example.com' })).toString('base64url');
        const fakeJwt = `header.${payload}.sig`;

        const decoded = (LocalAuthServer as any).decodeJwt(fakeJwt) as Record<string, unknown>;
        expect(decoded.email).toBe('user@example.com');

        const extracted = (LocalAuthServer as any).extractEmailFromTokenData({
            id_token: fakeJwt,
            access_token: 'a',
            expires_in: 3600,
        });
        expect(extracted).toBe('user@example.com');
    });
});
