import React, { useEffect, useState } from 'react'

interface ConfettiPiece {
    id: number
    x: number
    color: string
    delay: number
    duration: number
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
    const [pieces, setPieces] = useState<ConfettiPiece[]>([])

    useEffect(() => {
        if (!active) {
            setPieces([])
            return
        }

        // Generate confetti pieces
        const newPieces: ConfettiPiece[] = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5,
            duration: 2 + Math.random() * 2
        }))

        setPieces(newPieces)

        // Clean up after animation
        const timer = setTimeout(() => {
            setPieces([])
        }, duration)

        return () => clearTimeout(timer)
    }, [active, particleCount, colors, duration])

    if (!active || pieces.length === 0) return null

    return (
        <>
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="confetti-piece"
                    style={{
                        left: `${piece.x}%`,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}s`,
                        animationDuration: `${piece.duration}s`,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        width: `${8 + Math.random() * 8}px`,
                        height: `${8 + Math.random() * 8}px`
                    }}
                />
            ))}
        </>
    )
}

Confetti.displayName = 'Confetti'
