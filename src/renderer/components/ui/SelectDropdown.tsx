import React, { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    FloatingPortal,
} from '@floating-ui/react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

interface SelectOption {
    value: string
    label: string
}

interface SelectDropdownProps {
    value: string
    options: SelectOption[]
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
    value,
    options,
    onChange,
    placeholder = 'Select...',
    className
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [width, setWidth] = useState<number>(0)

    const {
        x,
        y,
        strategy,
        refs,
        placement,
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(4),
            flip(),
            shift({ padding: 8 }),
        ],
        whileElementsMounted: autoUpdate,
    })

    const setReferenceNode = React.useCallback((node: HTMLElement | null) => {
        refs.setReference(node)
    }, [refs])

    const setFloatingNode = React.useCallback((node: HTMLElement | null) => {
        refs.setFloating(node)
    }, [refs])

    const selectedOption = options.find(opt => opt.value === value)
    const isUp = placement.startsWith('top')

    const handleSelect = (optValue: string) => {
        onChange(optValue)
        setIsOpen(false)
    }

    React.useEffect(() => {
        const reference = refs.domReference.current
        if (isOpen && reference) {
            setWidth((reference as HTMLElement).offsetWidth)
        }
    }, [isOpen, refs.domReference])

    return (
        <div ref={setReferenceNode} className={cn("relative w-full", className)}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(!isOpen)
                }}
                className={cn(
                    "w-full flex items-center justify-between bg-muted/20 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-1 focus:ring-primary/50 group/select shadow-sm hover:border-white/20",
                    isOpen ? "border-primary/40 bg-primary/5" : "text-primary/90 hover:bg-muted/30"
                )}
            >
                <span className="truncate">{selectedOption?.label || placeholder}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2 group-hover/select:text-primary/70", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <FloatingPortal>
                        <motion.div
                            ref={setFloatingNode}
                            initial={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            style={{
                                position: strategy,
                                top: y ?? 0,
                                left: x ?? 0,
                                zIndex: 10000,
                                width: width || 'auto'
                            }}
                            className="bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1">
                                {options.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={cn(
                                            "w-full px-4 py-2 text-left text-sm font-medium transition-all flex items-center justify-between group/item",
                                            opt.value === value
                                                ? "bg-primary/15 text-primary"
                                                : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        {opt.value === value && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </FloatingPortal>
                )}
            </AnimatePresence>
        </div>
    )
}
