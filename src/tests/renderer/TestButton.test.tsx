import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect,test } from 'vitest';

// Simple component for testing React Testing Library setup
const HelloWorld: React.FC<{ name?: string }> = ({ name = 'World' }) => {
    return (
        <div data-testid="hello-world">
            <h1>Hello, {name}!</h1>
            <p>Welcome to Tengra testing</p>
        </div>
    );
};

describe('React Testing Library Setup', () => {
    test('renders hello world component', () => {
        render(<HelloWorld />);
        
        expect(screen.getByText('Hello, World!')).toBeInTheDocument();
        expect(screen.getByText('Welcome to Tengra testing')).toBeInTheDocument();
        expect(screen.getByTestId('hello-world')).toBeInTheDocument();
    });

    test('renders with custom name', () => {
        render(<HelloWorld name="Tengra" />);
        
        expect(screen.getByText('Hello, Tengra!')).toBeInTheDocument();
    });

    test('component has correct structure', () => {
        render(<HelloWorld />);
        
        const container = screen.getByTestId('hello-world');
        expect(container).toHaveProperty('tagName', 'DIV');
        
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toBeInTheDocument();
    });
});
