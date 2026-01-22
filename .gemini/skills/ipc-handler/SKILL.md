---
name: IPC Handler
description: Create IPC handlers for main-renderer communication
---

# IPC Handler Skill

This skill guides you through creating IPC handlers for Electron main-renderer communication.

## Understanding IPC

IPC (Inter-Process Communication) allows the renderer (React) to call functions in the main (Node) process.

## File Structure

IPC handlers are in `src/main/ipc/{domain}.ts`

## Handler Template

```typescript
import { ipcMain } from 'electron'
import { appLogger } from '@main/logging/logger'
import { ServiceResponse } from '@shared/types'

export function registerMyHandlers(service: MyService): void {
    ipcMain.handle('my:action', async (_event, args): Promise<ServiceResponse<ResultType>> => {
        try {
            const result = await service.doSomething(args)
            return { success: true, data: result }
        } catch (error) {
            appLogger.error('IPC', 'my:action failed', error as Error)
            return { success: false, error: (error as Error).message }
        }
    })
}
```

## Preload Script

Expose the handler in `src/main/preload.ts`:

```typescript
my: {
    action: (args: ArgsType) => ipcRenderer.invoke('my:action', args)
}
```

## Renderer Usage

```typescript
const result = await window.api.my.action({ param: 'value' })
if (result.success) {
    // use result.data
}
```

## Security Rules

- Always validate input in the handler
- Never expose sensitive data directly
- Return ServiceResponse format consistently
