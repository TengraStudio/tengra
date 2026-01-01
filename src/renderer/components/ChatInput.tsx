import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface ChatInputProps {
    onSend: (content: string) => void
    disabled?: boolean
    placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
    const [input, setInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [input])

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input.trim())
            setInput('')
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="input-area">
            <div className="input-container">
                <div className="input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="message-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || 'Mesajınızı yazın... (Shift+Enter: yeni satır)'}
                        disabled={disabled}
                        rows={1}
                    />
                </div>

                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                >
                    ➤
                </button>
            </div>
        </div>
    )
}
