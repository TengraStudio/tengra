import { ipcMain, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { appLogger } from '../logging/logger'

export function registerGalleryIpc(galleryPath: string) {

    // Ensure gallery exists
    if (!fs.existsSync(galleryPath)) {
        try {
            fs.mkdirSync(galleryPath, { recursive: true })
        } catch (e) {
            appLogger.error(`Failed to create gallery path: ${e}`)
        }
    }

    ipcMain.handle('gallery:list', async () => {
        try {
            const files = await fs.promises.readdir(galleryPath)
            // Filter images and map to full paths
            return files
                .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
                .map(f => {
                    const fullPath = path.join(galleryPath, f)
                    return {
                        name: f,
                        path: fullPath,
                        url: `safe-file://${fullPath.replace(/\\/g, '/')}`,
                        mtime: fs.statSync(fullPath).mtime.getTime() // Sync is fast enough for stat here usually
                    }
                })
                .sort((a, b) => b.mtime - a.mtime) // Newest first
        } catch (error) {
            appLogger.error(`Gallery List Error: ${error}`)
            return []
        }
    })

    ipcMain.handle('gallery:delete', async (_event, filePath) => {
        try {
            // Security check: ensure filePath is within galleryPath
            if (!filePath.startsWith(galleryPath) && !filePath.includes('Orbit/Gallery')) {
                throw new Error('Unauthorized file deletion')
            }
            await fs.promises.unlink(filePath)
            return true
        } catch (error) {
            appLogger.error(`Gallery Delete Error: ${error}`)
            return false
        }
    })

    ipcMain.handle('gallery:open', async (_event, filePath) => {
        try {
            await shell.openPath(filePath)
            return true
        } catch (error) {
            appLogger.error(`Gallery Open Error: ${error}`)
            return false
        }
    })

    ipcMain.handle('gallery:reveal', async (_event, filePath) => {
        try {
            shell.showItemInFolder(filePath)
            return true
        } catch (error) {
            appLogger.error(`Gallery Reveal Error: ${error}`)
            return false
        }
    })
}
