/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useEffect, useState } from 'react';


interface ConfettiPiece {
    id: number
    x: number
    color: string
    delay: number
    duration: number
    size: number
    isRound: boolean
}

interface ConfettiProps {
    active: boolean
    duration?: number
    particleCount?: number
    colors?: string[]
}

/**
 * Confetti Component
 * 
 * Shows a celebratory confetti animation.
 * 
 * @example
 * ```tsx
 * <Confetti active={showConfetti} />
 * ```
 */
export const Confetti: React.FC<ConfettiProps> = ({
    active,
    duration = 3000,
    particleCount = 50,
    colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4fd1c5', '#ffd93d']
}) => {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

    useEffect(() => {
        if (!active) {
            setTimeout(() => setPieces([]), 0);
            return;
        }

        // Generate confetti pieces
        const newPieces: ConfettiPiece[] = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5,
            duration: 2 + Math.random() * 2,
            size: 8 + Math.random() * 8,
            isRound: Math.random() > 0.5
        }));

        setTimeout(() => setPieces(newPieces), 0);

        // Clean up after animation
        const timer = setTimeout(() => {
            setPieces([]);
        }, duration);

        return () => clearTimeout(timer);
    }, [active, particleCount, colors, duration]);

    if (!active || pieces.length === 0) { return null; }

    return (
        <>
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="fixed -top-5 z-9999 pointer-events-none animate-confetti-fall"
                    style={{
                        left: `${piece.x}%`,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}s`,
                        '--confetti-duration': `${piece.duration}s`,
                        borderRadius: piece.isRound ? '50%' : '2px',
                        width: `${piece.size}px`,
                        height: `${piece.size}px`
                    } as React.CSSProperties}
                />
            ))}
        </>
    );
};

Confetti.displayName = 'Confetti';
