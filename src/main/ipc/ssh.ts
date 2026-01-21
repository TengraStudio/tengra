import { randomUUID } from 'crypto'

import { SSHConnection, SSHService } from '@main/services/project/ssh.service'
import { IpcValue, JsonValue } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import { BrowserWindow, ipcMain } from 'electron'

export function registerSshIpc(getMainWindow: () => BrowserWindow | null, sshService: SSHService) {
    const send = (channel: string, data: JsonValue) => {
        const win = getMainWindow()
        if (win) {
            win.webContents.send(channel, data)
        }
    }

    sshService.on('stdout', (payload) => send('ssh:stdout', payload))
    sshService.on('stderr', (payload) => send('ssh:stderr', payload))
    sshService.on('connected', (id) => send('ssh:connected', id))
    sshService.on('disconnected', (id) => send('ssh:disconnected', id))
    sshService.on('error', (payload) => send('ssh:error', payload))

    registerConnectionHandlers(sshService)
    registerCommandHandlers(sshService, send)
    registerFileSystemHandlers(sshService, send)
    registerSystemHandlers(sshService)
}

function registerConnectionHandlers(sshService: SSHService) {
    ipcMain.handle('ssh:connect', async (_event, connection: Partial<SSHConnection> & { host: string; username: string }) => {
        const id = connection.id ?? randomUUID()
        const port = connection.port ?? 22
        const authType = connection.authType ?? (connection.privateKey ? 'key' : 'password')
        const payload: SSHConnection = {
            id,
            name: connection.name ?? `${connection.username}@${connection.host}`,
            host: connection.host,
            port,
            username: connection.username,
            authType,
            password: connection.password,
            privateKey: connection.privateKey,
            passphrase: connection.passphrase,
            connected: false
        }

        const result = await sshService.connect(payload)
        return { ...result, id }
    })

    ipcMain.handle('ssh:disconnect', async (_event, connectionId: string) => {
        try {
            await sshService.disconnect(connectionId)
            return { success: true }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:getConnections', async () => {
        return sshService.getAllConnections()
    })

    ipcMain.handle('ssh:isConnected', async (_event, connectionId: string) => {
        return sshService.isConnected(connectionId)
    })

    ipcMain.handle('ssh:getProfiles', async () => {
        return await sshService.getSavedProfiles()
    })

    ipcMain.handle('ssh:saveProfile', async (_event, profile: SSHConnection) => {
        try {
            return await sshService.saveProfile(profile)
        } catch {
            return false
        }
    })

    ipcMain.handle('ssh:deleteProfile', async (_event, id: string) => {
        try {
            return await sshService.deleteProfile(id)
        } catch {
            return false
        }
    })
}

function registerCommandHandlers(sshService: SSHService, send: (channel: string, data: JsonValue) => void) {
    ipcMain.handle('ssh:execute', async (_event, connectionId: string, command: string, options?: Record<string, IpcValue>) => {
        try {
            return await sshService.executeCommand(connectionId, command, options)
        } catch (error) {
            const message = getErrorMessage(error as Error)
            return { success: false, error: message, stdout: '', stderr: message, code: 1 }
        }
    })

    ipcMain.handle('ssh:shellStart', async (_event, connectionId: string) => {
        return await sshService.startShell(
            connectionId,
            (data) => send('ssh:shellData', { connectionId, data }),
            () => send('ssh:disconnected', connectionId)
        )
    })

    ipcMain.handle('ssh:shellWrite', async (_event, payload: { connectionId: string; data: string }) => {
        const success = sshService.sendShellData(payload.connectionId, payload.data)
        return { success }
    })
}

function registerFileSystemHandlers(sshService: SSHService, send: (channel: string, data: JsonValue) => void) {
    ipcMain.handle('ssh:listDir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            return await sshService.listDirectory(payload.connectionId, payload.path)
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:readFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const content = await sshService.readFile(payload.connectionId, payload.path)
            return { success: true, content }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:writeFile', async (_event, payload: { connectionId: string; path: string; content: string }) => {
        try {
            const success = await sshService.writeFile(payload.connectionId, payload.path, payload.content)
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:deleteDir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.deleteDirectory(payload.connectionId, payload.path)
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:deleteFile', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.deleteFile(payload.connectionId, payload.path)
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:mkdir', async (_event, payload: { connectionId: string; path: string }) => {
        try {
            const success = await sshService.createDirectory(payload.connectionId, payload.path)
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:rename', async (_event, payload: { connectionId: string; oldPath: string; newPath: string }) => {
        try {
            const success = await sshService.rename(payload.connectionId, payload.oldPath, payload.newPath)
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:upload', async (_event, payload: { connectionId: string; local: string; remote: string }) => {
        try {
            const success = await sshService.uploadFile(payload.connectionId, payload.local, payload.remote, (transferred, total) => {
                send('ssh:uploadProgress', { connectionId: payload.connectionId, transferred, total })
            })
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })

    ipcMain.handle('ssh:download', async (_event, payload: { connectionId: string; remote: string; local: string }) => {
        try {
            const success = await sshService.downloadFile(payload.connectionId, payload.remote, payload.local, (transferred, total) => {
                send('ssh:downloadProgress', { connectionId: payload.connectionId, transferred, total })
            })
            return { success }
        } catch (_error) {
            return { success: false, error: getErrorMessage(_error as Error) }
        }
    })
}

function registerSystemHandlers(sshService: SSHService) {
    ipcMain.handle('ssh:getSystemStats', async (_event, connectionId: string) => {
        try {
            return await sshService.getSystemStats(connectionId)
        } catch (error) {
            const message = getErrorMessage(error as Error)
            return { error: message, uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' }
        }
    })

    ipcMain.handle('ssh:getInstalledPackages', async (_event, connectionId: string, manager?: 'apt' | 'npm' | 'pip') => {
        try {
            return await sshService.getInstalledPackages(connectionId, manager)
        } catch {
            return []
        }
    })

    ipcMain.handle('ssh:getLogFiles', async (_event, connectionId: string) => {
        try {
            return await sshService.getLogFiles(connectionId)
        } catch {
            return []
        }
    })

    ipcMain.handle('ssh:readLogFile', async (_event, payload: { connectionId: string; path: string; lines?: number }) => {
        try {
            return await sshService.readLogFile(payload.connectionId, payload.path, payload.lines)
        } catch (error) {
            return getErrorMessage(error as Error)
        }
    })
}
