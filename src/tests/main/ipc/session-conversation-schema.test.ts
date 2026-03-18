import { sessionConversationMessageSchema } from '@shared/schemas/session-conversation-ipc.schema';
import { describe, expect,it } from 'vitest';

describe('sessionConversationMessageSchema', () => {
    it('should validate and transform string timestamps', () => {
        const isoString = '2024-03-14T12:00:00Z';
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: isoString
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(new Date(isoString).getTime());
    });

    it('should validate and transform numeric timestamps', () => {
        const now = Date.now();
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: now
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(now);
    });

    it('should validate and transform Date objects', () => {
        const date = new Date();
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello',
            timestamp: date
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(result.timestamp.getTime()).toBe(date.getTime());
    });

    it('should use current date if timestamp is missing', () => {
        const result = sessionConversationMessageSchema.parse({
            role: 'user',
            content: 'hello'
        });
        expect(result.timestamp).toBeInstanceOf(Date);
        // Approximately now
        expect(Math.abs(result.timestamp.getTime() - Date.now())).toBeLessThan(1000);
    });
});
