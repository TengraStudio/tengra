/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';

export type Transition<S extends string, E extends string> = {
    from: S[];
    to: S;
    on?: E;
    action?: () => void | Promise<void>;
};

export class StateMachine<S extends string, E extends string> {
    private currentState: S;
    private transitions: Transition<S, E>[];
    private name: string;

    constructor(name: string, initialState: S, transitions: Transition<S, E>[]) {
        this.name = name;
        this.currentState = initialState;
        this.transitions = transitions;
    }

    public get state(): S {
        return this.currentState;
    }

    /**
     * Force set state, useful for hydration or testing.
     * @param newState State to force set
     */
    public setState(newState: S): void {
        this.currentState = newState;
    }

    public can(newState: S): boolean {
        return this.transitions.some(t => t.to === newState && t.from.includes(this.currentState));
    }

    public async transitionTo(newState: S, event?: E): Promise<void> {
        const transition = this.transitions.find(t =>
            t.to === newState &&
            t.from.includes(this.currentState) &&
            (event ? t.on === event : true)
        );

        if (!transition) {
            const error = `Invalid transition in ${this.name}: ${this.currentState} -> ${newState} ${event ? `(event: ${event})` : ''}`;
            appLogger.error(this.name, error);
            throw new Error(error);
        }

        const oldState = this.currentState;
        this.currentState = newState;
        appLogger.info(this.name, `State changed: ${oldState} -> ${newState}`);

        if (transition.action) {
            try {
                await transition.action();
            } catch (error) {
                appLogger.error(this.name, `Error during transition action ${oldState} -> ${newState}`, error as Error);
                // We don't revert state on action failure, but we log it. 
                // In a stricter machine we might want to revert or go to an error state.
            }
        }
    }
}

