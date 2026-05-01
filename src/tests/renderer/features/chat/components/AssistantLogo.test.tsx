/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssistantLogo } from '@/features/chat/components/message/AssistantLogo';

const t = (key: string): string => key;

describe('AssistantLogo', () => {
    it('prefers the explicit provider when rendering an opencode-backed GPT model', () => {
        render(
            <AssistantLogo
                displayModel="gpt-5.5"
                provider="opencode"
                backend="openai"
                t={t}
            />
        );

        expect(screen.getByAltText('opencode')).toBeInTheDocument();
    });

    it('infers openai branding from GPT family models when provider metadata is missing', () => {
        render(
            <AssistantLogo
                displayModel="gpt-5.4-mini"
                t={t}
            />
        );

        expect(screen.getByAltText('openai')).toBeInTheDocument();
    });
});
