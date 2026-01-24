import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Simple component for testing React Testing Library setup
const HelloWorld: React.FC<{ name?: string }> = ({ name = 'World' }) => {
    return (
        <div data-testid="hello-world">
            <h1>Hello, {name}!</h1>
            <p>Welcome to Orbit testing</p>
        </div>
    )
}

describe('React Testing Library Setup', () => {
    test('renders hello world component', () => {
        render(<HelloWorld />)
        
        expect(screen.getByText('Hello, World!')).toBeInTheDocument()
        expect(screen.getByText('Welcome to Orbit testing')).toBeInTheDocument()
        expect(screen.getByTestId('hello-world')).toBeInTheDocument()
    })

    test('renders with custom name', () => {
        render(<HelloWorld name="Orbit" />)
        
        expect(screen.getByText('Hello, Orbit!')).toBeInTheDocument()
    })

    test('component has correct structure', () => {
        render(<HelloWorld />)
        
        const container = screen.getByTestId('hello-world')
        expect(container).toHaveProperty('tagName', 'DIV')
        
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toBeInTheDocument()
    })
})