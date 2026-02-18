import { randomUUID } from 'crypto';

import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

const WakeWordPayloadSchema = z.object({
    transcript: z.string().min(1).max(4000),
    wakeWord: z.string().min(1).max(80).optional()
});

const WakeWordResultSchema = z.object({
    activated: z.boolean(),
    wakeWord: z.string(),
    intent: z.enum(['none', 'new_chat', 'open_settings', 'stop_speaking', 'send_message', 'search_workspace']),
    commandText: z.string(),
    confidence: z.number().min(0).max(1)
});

const SessionStartPayloadSchema = z.object({
    wakeWord: z.string().min(1).max(80).optional(),
    locale: z.string().min(2).max(20).optional()
});

const SessionStateSchema = z.object({
    id: z.string(),
    wakeWord: z.string(),
    locale: z.string(),
    state: z.enum(['listening', 'speaking', 'idle']),
    turnCount: z.number().int().nonnegative(),
    startedAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative()
});

const SessionUtterancePayloadSchema = z.object({
    sessionId: z.string().min(1),
    transcript: z.string().min(1).max(4000),
    assistantSpeaking: z.boolean().optional()
});

const SessionUtteranceResultSchema = z.object({
    session: SessionStateSchema,
    interruptAssistant: z.boolean(),
    intent: WakeWordResultSchema.shape.intent,
    commandText: z.string(),
    responseMode: z.enum(['listen', 'speak', 'idle'])
});

const VoiceNoteCreatePayloadSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    transcript: z.string().min(1).max(50000)
});

const VoiceNoteSchema = z.object({
    id: z.string(),
    title: z.string(),
    transcript: z.string(),
    summary: z.string(),
    keyPoints: z.array(z.string()),
    actionItems: z.array(z.string()),
    highlights: z.array(z.object({
        timestampSec: z.number().int().nonnegative(),
        text: z.string(),
        speaker: z.string()
    })),
    speakers: z.array(z.string()),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative()
});

const VoiceNoteSearchPayloadSchema = z.object({
    query: z.string().min(1).max(300),
    limit: z.number().int().min(1).max(200).optional()
});

type VoiceIntent = z.infer<typeof WakeWordResultSchema>['intent'];

interface VoiceSessionState {
    id: string;
    wakeWord: string;
    locale: string;
    state: 'listening' | 'speaking' | 'idle';
    turnCount: number;
    startedAt: number;
    updatedAt: number;
}

const DEFAULT_WAKE_WORD = 'hey tandem';

const inferIntent = (commandText: string): VoiceIntent => {
    const text = commandText.toLowerCase();
    if (!text) {
        return 'none';
    }
    if (text.includes('new chat')) {
        return 'new_chat';
    }
    if (text.includes('open settings') || text.includes('settings')) {
        return 'open_settings';
    }
    if (text.includes('stop speaking') || text.includes('be quiet')) {
        return 'stop_speaking';
    }
    if (text.startsWith('send ') || text.startsWith('message ')) {
        return 'send_message';
    }
    if (text.startsWith('search ') || text.startsWith('find ')) {
        return 'search_workspace';
    }
    return 'none';
};

const detectWakeWord = (
    transcript: string,
    wakeWord: string
): z.infer<typeof WakeWordResultSchema> => {
    const normalizedTranscript = transcript.trim().toLowerCase();
    const normalizedWakeWord = wakeWord.trim().toLowerCase();
    const wakeIndex = normalizedTranscript.indexOf(normalizedWakeWord);
    if (wakeIndex < 0) {
        return {
            activated: false,
            wakeWord,
            intent: 'none',
            commandText: transcript.trim(),
            confidence: 0
        };
    }
    const commandText = normalizedTranscript
        .slice(wakeIndex + normalizedWakeWord.length)
        .replace(/^[,:;\-\s]+/, '')
        .trim();
    const intent = inferIntent(commandText);
    const confidence = Math.max(0.2, Math.min(0.99, commandText.length > 0 ? 0.85 : 0.6));
    return {
        activated: true,
        wakeWord,
        intent,
        commandText,
        confidence
    };
};

const splitSentences = (transcript: string): string[] => {
    return transcript
        .split(/[\n.!?]+/)
        .map(part => part.trim())
        .filter(part => part.length > 0);
};

const extractActionItems = (sentences: string[]): string[] => {
    const actionRegex = /\b(todo|follow up|need to|should|action|must|next step)\b/i;
    return sentences
        .filter(sentence => actionRegex.test(sentence))
        .slice(0, 10);
};

const createSummary = (sentences: string[]): string => {
    if (sentences.length === 0) {
        return '';
    }
    const best = [...sentences]
        .sort((left, right) => right.length - left.length)
        .slice(0, 3);
    return best.join('. ');
};

const createHighlights = (sentences: string[]): Array<{ timestampSec: number; text: string; speaker: string }> => {
    const highlights: Array<{ timestampSec: number; text: string; speaker: string }> = [];
    for (let index = 0; index < sentences.length && highlights.length < 12; index += 1) {
        highlights.push({
            timestampSec: index * 15,
            text: sentences[index],
            speaker: index % 2 === 0 ? 'speaker-1' : 'speaker-2'
        });
    }
    return highlights;
};

export function registerVoiceIpc(): void {
    const sessions = new Map<string, VoiceSessionState>();
    const notes = new Map<string, z.infer<typeof VoiceNoteSchema>>();

    ipcMain.handle(
        'voice:wake-word-detect',
        createValidatedIpcHandler(
            'voice:wake-word-detect',
            async (_event, payload: z.infer<typeof WakeWordPayloadSchema>) => {
                return detectWakeWord(payload.transcript, payload.wakeWord ?? DEFAULT_WAKE_WORD);
            },
            {
                argsSchema: z.tuple([WakeWordPayloadSchema]),
                responseSchema: WakeWordResultSchema
            }
        )
    );

    ipcMain.handle(
        'voice:session-start',
        createValidatedIpcHandler(
            'voice:session-start',
            async (_event, payload: z.infer<typeof SessionStartPayloadSchema>) => {
                const session: VoiceSessionState = {
                    id: randomUUID(),
                    wakeWord: payload.wakeWord ?? DEFAULT_WAKE_WORD,
                    locale: payload.locale ?? 'en-US',
                    state: 'listening',
                    turnCount: 0,
                    startedAt: Date.now(),
                    updatedAt: Date.now()
                };
                sessions.set(session.id, session);
                return session;
            },
            {
                argsSchema: z.tuple([SessionStartPayloadSchema]),
                responseSchema: SessionStateSchema
            }
        )
    );

    ipcMain.handle(
        'voice:session-utterance',
        createValidatedIpcHandler(
            'voice:session-utterance',
            async (_event, payload: z.infer<typeof SessionUtterancePayloadSchema>) => {
                const session = sessions.get(payload.sessionId);
                if (!session) {
                    throw new Error('Voice session not found');
                }
                const wakeResult = detectWakeWord(payload.transcript, session.wakeWord);
                const interruptAssistant = Boolean(payload.assistantSpeaking) && wakeResult.activated;
                session.turnCount += 1;
                session.updatedAt = Date.now();
                session.state = wakeResult.intent === 'none' ? 'idle' : 'speaking';
                sessions.set(session.id, session);

                return {
                    session,
                    interruptAssistant,
                    intent: wakeResult.intent,
                    commandText: wakeResult.commandText,
                    responseMode: wakeResult.intent === 'none' ? 'listen' : 'speak'
                };
            },
            {
                argsSchema: z.tuple([SessionUtterancePayloadSchema]),
                responseSchema: SessionUtteranceResultSchema
            }
        )
    );

    ipcMain.handle(
        'voice:session-end',
        createValidatedIpcHandler(
            'voice:session-end',
            async (_event, sessionId: string) => {
                sessions.delete(sessionId);
                return { success: true };
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.object({ success: z.literal(true) })
            }
        )
    );

    ipcMain.handle(
        'voice:note-create',
        createValidatedIpcHandler(
            'voice:note-create',
            async (_event, payload: z.infer<typeof VoiceNoteCreatePayloadSchema>) => {
                const sentences = splitSentences(payload.transcript);
                const note: z.infer<typeof VoiceNoteSchema> = {
                    id: randomUUID(),
                    title: payload.title?.trim() || (sentences[0] ? sentences[0].slice(0, 60) : 'Voice Note'),
                    transcript: payload.transcript,
                    summary: createSummary(sentences),
                    keyPoints: [...sentences].sort((left, right) => right.length - left.length).slice(0, 8),
                    actionItems: extractActionItems(sentences),
                    highlights: createHighlights(sentences),
                    speakers: ['speaker-1', 'speaker-2'],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                notes.set(note.id, note);
                return note;
            },
            {
                argsSchema: z.tuple([VoiceNoteCreatePayloadSchema]),
                responseSchema: VoiceNoteSchema
            }
        )
    );

    ipcMain.handle(
        'voice:note-list',
        createValidatedIpcHandler(
            'voice:note-list',
            async () => {
                return { notes: Array.from(notes.values()).sort((left, right) => right.updatedAt - left.updatedAt) };
            },
            {
                argsSchema: z.tuple([]),
                responseSchema: z.object({ notes: z.array(VoiceNoteSchema) })
            }
        )
    );

    ipcMain.handle(
        'voice:note-get',
        createValidatedIpcHandler(
            'voice:note-get',
            async (_event, noteId: string) => {
                return { note: notes.get(noteId) ?? null };
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.object({ note: VoiceNoteSchema.nullable() })
            }
        )
    );

    ipcMain.handle(
        'voice:note-search',
        createValidatedIpcHandler(
            'voice:note-search',
            async (_event, payload: z.infer<typeof VoiceNoteSearchPayloadSchema>) => {
                const normalizedQuery = payload.query.trim().toLowerCase();
                const limit = payload.limit ?? 25;
                const result = Array.from(notes.values())
                    .filter(note =>
                        note.title.toLowerCase().includes(normalizedQuery)
                        || note.summary.toLowerCase().includes(normalizedQuery)
                        || note.transcript.toLowerCase().includes(normalizedQuery)
                    )
                    .slice(0, limit);
                return { notes: result };
            },
            {
                argsSchema: z.tuple([VoiceNoteSearchPayloadSchema]),
                responseSchema: z.object({ notes: z.array(VoiceNoteSchema) })
            }
        )
    );

    ipcMain.handle(
        'voice:note-delete',
        createValidatedIpcHandler(
            'voice:note-delete',
            async (_event, noteId: string) => {
                const deleted = notes.delete(noteId);
                return { deleted };
            },
            {
                argsSchema: z.tuple([z.string().min(1)]),
                responseSchema: z.object({ deleted: z.boolean() })
            }
        )
    );
}
