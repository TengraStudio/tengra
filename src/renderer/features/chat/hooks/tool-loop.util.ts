import { Message } from '@/types';

export function buildModelConversation(
    messages: Message[],
    assistantMessage: Message,
    toolResults: Message[]
): Message[] {
    return [...messages, assistantMessage, ...toolResults];
}

export function hasAlternatingToolLoop(
    recentSignatures: string[],
    recentSignatureWindow: number
): boolean {
    if (recentSignatures.length < recentSignatureWindow) {
        return false;
    }
    const [first, second, third, fourth] = recentSignatures.slice(-recentSignatureWindow);
    if (!first || !second || !third || !fourth) {
        return false;
    }
    return first === third && second === fourth && first !== second;
}

export function updateRecentToolSignatures(
    recentSignatures: string[],
    nextSignature: string,
    recentSignatureWindow: number
): string[] {
    const next = [...recentSignatures, nextSignature];
    if (next.length <= recentSignatureWindow) {
        return next;
    }
    return next.slice(next.length - recentSignatureWindow);
}
