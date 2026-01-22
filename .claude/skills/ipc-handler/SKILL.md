---
name: IPC Handler
description: Create IPC handlers for main-renderer communication
---

# IPC Handler Skill

## Location

`src/main/ipc/{domain}.ts`

## Handler Template

```typescript
import { ipcMain } from 'electron'
import { appLogger } from '@main/logging/logger'
import { ServiceResponse } from '@shared/types'

export function register{Domain}Handlers(service: {Service}Service): void {
    ipcMain.handle('{domain}:{action}', async (_event, args): Promise<ServiceResponse<ResultType>> => {
        try {
            const result = await service.doSomething(args)
            return { success: true, data: result }
        } catch (error) {
            appLogger.error('IPC', '{domain}:{action} failed', error as Error)
            return { success: false, error: (error as Error).message }
        }
    })
}
```

## Preload Exposure

Add to `src/main/preload.ts`:

```typescript
{domain}: {
    {action}: (args: ArgsType) => ipcRenderer.invoke('{domain}:{action}', args)
}
```

## Renderer Usage

```typescript
const result = await window.api.{domain}.{action}(args)
if (result.success) {
    // use result.data
}
```
