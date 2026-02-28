import { useCallback, useRef, useState } from 'react'
import { UndoRedoStack } from '@/utils/undo-redo.util'

/** Return type for the useUndoRedo hook. */
interface UndoRedoHook<T> {
  state: T
  set: (newState: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * React hook providing undo/redo capabilities for any state.
 * @template T - The state type to track
 * @param initialState - The initial state value
 * @param maxHistory - Maximum number of undo steps (default 20)
 */
export function useUndoRedo<T>(initialState: T, maxHistory = 20): UndoRedoHook<T> {
  const stackRef = useRef(new UndoRedoStack<T>(initialState, maxHistory))
  const [state, setState] = useState<T>(initialState)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = useCallback(() => {
    setCanUndo(stackRef.current.canUndo)
    setCanRedo(stackRef.current.canRedo)
  }, [])

  const set = useCallback((newState: T) => {
    stackRef.current.push(newState)
    setState(stackRef.current.state)
    syncFlags()
  }, [syncFlags])

  const undo = useCallback(() => {
    const prev = stackRef.current.undo()
    if (prev !== undefined) {
      setState(prev)
      syncFlags()
    }
  }, [syncFlags])

  const redo = useCallback(() => {
    const next = stackRef.current.redo()
    if (next !== undefined) {
      setState(next)
      syncFlags()
    }
  }, [syncFlags])

  return { state, set, undo, redo, canUndo, canRedo }
}
