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
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

interface SettingsSavePayload {
    theme: string;
    language: string;
}

// Mock a critical UI component (like a settings page button)
const SettingsButton: React.FC<{ 
    onSave: (data: SettingsSavePayload) => void; 
    disabled?: boolean;
    loading?: boolean; 
}> = ({ 
    onSave, 
    disabled = false, 
    loading = false 
}) => {
    const handleClick = () => {
        onSave({ theme: 'dark', language: 'en' });
    };

    return (
        <button 
            onClick={handleClick} 
            disabled={disabled || loading}
            data-testid="settings-save-button"
            aria-label={loading ? 'Saving...' : 'Save Settings'}
        >
            {loading ? 'Saving...' : 'Save Settings'}
        </button>
    );
};

describe('SettingsButton', () => {
    test('renders with correct text', () => {
        const mockOnSave = vi.fn();
        render(<SettingsButton onSave={mockOnSave} />);
        
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
        expect(screen.getByLabelText('Save Settings')).toBeInTheDocument();
        expect(screen.getByTestId('settings-save-button')).toBeInTheDocument();
    });

    test('calls onSave with data when clicked', async () => {
        const user = userEvent.setup();
        const mockOnSave = vi.fn();
        
        render(<SettingsButton onSave={mockOnSave} />);
        
        const button = screen.getByTestId('settings-save-button');
        await user.click(button);
        
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith({ theme: 'dark', language: 'en' });
    });

    test('shows loading state correctly', () => {
        const mockOnSave = vi.fn();
        render(<SettingsButton onSave={mockOnSave} loading={true} />);
        
        const button = screen.getByTestId('settings-save-button');
        expect(button).toHaveTextContent('Saving...');
        expect(button).toHaveAttribute('aria-label', 'Saving...');
        expect(button).toBeDisabled();
    });

    test('disables button when disabled prop is true', async () => {
        const user = userEvent.setup();
        const mockOnSave = vi.fn();
        
        render(<SettingsButton onSave={mockOnSave} disabled={true} />);
        
        const button = screen.getByTestId('settings-save-button');
        expect(button).toBeDisabled();
        
        await user.click(button);
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    test('handles multiple rapid clicks gracefully', async () => {
        const user = userEvent.setup();
        const mockOnSave = vi.fn();
        
        render(<SettingsButton onSave={mockOnSave} />);
        
        const button = screen.getByTestId('settings-save-button');
        
        // Simulate rapid clicking
        await user.click(button);
        await user.click(button);
        await user.click(button);
        
        expect(mockOnSave).toHaveBeenCalledTimes(3);
    });
});
