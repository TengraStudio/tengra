/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatTemplate } from '@/features/chat/types';

// Mock useThemeDetection hook
vi.mock('@/hooks/useTheme', () => ({
    useThemeDetection: () => ({ isLight: true, isDark: false }),
}));

import { WelcomeScreen } from '@/features/chat/components/WelcomeScreen';

const mockTemplates: ChatTemplate[] = [
    {
        id: 'code',
        icon: 'code',
        iconColor: 'text-blue-500',
        title: 'Write Code',
        description: 'Generate code snippets',
        prompt: 'Help me write code',
    },
    {
        id: 'write',
        icon: 'pen',
        iconColor: 'text-green-500',
        title: 'Write Text',
        description: 'Write content',
        prompt: 'Help me write',
    },
];

describe('WelcomeScreen', () => {
    const translations: Record<string, string> = {
        'welcome.title': 'Welcome to Tengra',
        'welcome.tagline': 'Build faster with your AI teammates',
        'welcome.logoAlt': 'Tengra logo',
    };
    const mockT = (key: string) => translations[key] ?? key;
    const mockOnSelect = vi.fn();

    it('renders without crashing', () => {
        const { container } = render(
            <WelcomeScreen t={mockT} templates={mockTemplates} onSelectTemplate={mockOnSelect} />
        );
        expect(container.firstChild).toBeTruthy();
    });

    it('displays welcome title and tagline', () => {
        render(
            <WelcomeScreen t={mockT} templates={mockTemplates} onSelectTemplate={mockOnSelect} />
        );
        expect(screen.getByText('Welcome to Tengra')).toBeInTheDocument();
        expect(screen.getByText('Build faster with your AI teammates')).toBeInTheDocument();
    });

    it('renders template buttons', () => {
        render(
            <WelcomeScreen t={mockT} templates={mockTemplates} onSelectTemplate={mockOnSelect} />
        );
        expect(screen.getByText('Write Code')).toBeInTheDocument();
        expect(screen.getByText('Write Text')).toBeInTheDocument();
    });

    it('calls onSelectTemplate with prompt when clicking a template', () => {
        render(
            <WelcomeScreen t={mockT} templates={mockTemplates} onSelectTemplate={mockOnSelect} />
        );
        fireEvent.click(screen.getByText('Write Code'));
        expect(mockOnSelect).toHaveBeenCalledWith('Help me write code');
    });

    it('calls onSelectTemplate with empty string for template without prompt', () => {
        const templatesNoPrompt: ChatTemplate[] = [
            {
                id: 'search',
                icon: 'search',
                iconColor: 'text-red-500',
                title: 'Search',
                description: 'Search stuff',
            },
        ];
        render(
            <WelcomeScreen t={mockT} templates={templatesNoPrompt} onSelectTemplate={mockOnSelect} />
        );
        fireEvent.click(screen.getByText('Search'));
        expect(mockOnSelect).toHaveBeenCalledWith('');
    });

    it('renders logo image', () => {
        render(
            <WelcomeScreen t={mockT} templates={mockTemplates} onSelectTemplate={mockOnSelect} />
        );
        const logo = screen.getByAltText('Tengra logo');
        expect(logo).toBeInTheDocument();
    });
});

