/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useSyncExternalStore } from 'react';

import { Chat, ChatError, Message, ToolCall } from '@/types';
export interface StreamingState {
    content: string;
    reasoning?: string;
    speed?: number | null;
    error?: ChatError | null;
    toolCalls?: ToolCall[];
    variants?: Record<string, { content: string; reasoning?: string }>;
}

interface ChatState {
    chats: Chat[];
    currentChatId: string | null;
    streamingStates: Record<string, StreamingState>;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultState: ChatState = {
    chats: [],
    currentChatId: null,
    streamingStates: {},
};

let state: ChatState = defaultState;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

export function getChatSnapshot(): ChatState {
    return state;
}

export function subscribeChat(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Hook to use the chat store with a selector for fine-grained reactivity.
 */
export function useChatStore<T>(selector: (snapshot: ChatState) => T): T {
    return useSyncExternalStore(subscribeChat, () => selector(state));
}

// Actions

export function setChats(updater: Chat[] | ((prev: Chat[]) => Chat[])): void {
    const nextChats = typeof updater === 'function' ? updater(state.chats) : updater;
    if (nextChats === state.chats) {return;}
    state = { ...state, chats: nextChats };
    emit();
}

export function setCurrentChatId(id: string | null): void {
    if (id === state.currentChatId) {return;}
    state = { ...state, currentChatId: id };
    emit();
}

export function updateChatInStore(chatId: string, updater: Partial<Chat> | ((prev: Chat) => Partial<Chat>)): void {
    state = {
        ...state,
        chats: state.chats.map(chat => {
            if (chat.id !== chatId) {return chat;}
            const updates = typeof updater === 'function' ? updater(chat) : updater;
            return { ...chat, ...updates };
        })
    };
    emit();
}

export function addMessageToStore(chatId: string, message: Message): void {
    state = {
        ...state,
        chats: state.chats.map(chat => {
            if (chat.id !== chatId) {return chat;}
            return {
                ...chat,
                messages: [...chat.messages, message],
                updatedAt: new Date()
            };
        }),
    };
    emit();
}

export function updateMessageInStore(chatId: string, messageId: string, updates: Partial<Message>): void {
    state = {
        ...state,
        chats: state.chats.map(chat => {
            if (chat.id !== chatId) {return chat;}
            return {
                ...chat,
                messages: chat.messages.map(msg => 
                    msg.id === messageId ? { ...msg, ...updates } : msg
                )
            };
        }),
    };
    emit();
}

export function setStreamingState(chatId: string, streaming: StreamingState | null): void {
    const nextStreamingStates = { ...state.streamingStates };
    if (streaming === null) {
        delete nextStreamingStates[chatId];
    } else {
        nextStreamingStates[chatId] = streaming;
    }
    state = { ...state, streamingStates: nextStreamingStates };
    emit();
}

export function updateStreamingState(chatId: string, updates: Partial<StreamingState>): void {
    const current = state.streamingStates[chatId];
    if (!current) {return;}
    
    state = {
        ...state,
        streamingStates: {
            ...state.streamingStates,
            [chatId]: { ...current, ...updates }
        }
    };
    emit();
}

export function clearAllChats(): void {
    state = { ...state, chats: [], currentChatId: null, streamingStates: {} };
    emit();
}

