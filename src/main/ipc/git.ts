import { GitService } from '@main/services/project/git.service'
import { getErrorMessage } from '@shared/utils/error.util'
import { ipcMain } from 'electron'

export function registerGitIpc(gitService: GitService) {
    // Get current branch
    ipcMain.handle('git:getBranch', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD')
            if (result.success && result.stdout) {
                return { success: true, branch: result.stdout.trim() }
            }
            return { success: false, error: 'Not a git repository' }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get repository status (clean/dirty)
    ipcMain.handle('git:getStatus', async (_event, cwd: string) => {
        try {
            const result = await gitService.getStatus(cwd)
            const isClean = result.length === 0
            return {
                success: true,
                isClean,
                changes: result.length,
                files: result
            }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get last commit info
    ipcMain.handle('git:getLastCommit', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'log -1 --pretty=format:"%h|%s|%an|%ar|%cI"')
            if (result.success && result.stdout) {
                const [hash, message, author, relativeTime, date] = result.stdout.trim().split('|')
                return {
                    success: true,
                    hash,
                    message,
                    author,
                    relativeTime,
                    date
                }
            }
            return { success: false, error: 'No commits found' }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get recent commits
    ipcMain.handle('git:getRecentCommits', async (_event, cwd: string, count: number = 10) => {
        try {
            const result = await gitService.getLog(cwd, count)
            return { success: true, commits: result }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), commits: [] }
        }
    })

    // Get all branches
    ipcMain.handle('git:getBranches', async (_event, cwd: string) => {
        try {
            const result = await gitService.getBranches(cwd)
            if (result.success && result.stdout) {
                const branches = result.stdout
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => line.trim().replace(/^\*\s*/, ''))
                return { success: true, branches }
            }
            return { success: false, branches: [] }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), branches: [] }
        }
    })

    // Check if directory is a git repository
    ipcMain.handle('git:isRepository', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'rev-parse --git-dir')
            return { success: true, isRepository: result.success }
        } catch (error) {
            return { success: false, isRepository: false }
        }
    })

    // Get file diff
    ipcMain.handle('git:getFileDiff', async (_event, cwd: string, filePath: string, staged: boolean = false) => {
        try {
            const result = await gitService.getFileDiff(cwd, filePath, staged)
            return result
        } catch (error) {
            return { original: '', modified: '', success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get unified diff
    ipcMain.handle('git:getUnifiedDiff', async (_event, cwd: string, filePath: string, staged: boolean = false) => {
        try {
            const result = await gitService.getUnifiedDiff(cwd, filePath, staged)
            return result
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Stage file
    ipcMain.handle('git:stageFile', async (_event, cwd: string, filePath: string) => {
        try {
            const result = await gitService.stageFile(cwd, filePath)
            return { success: result.success, error: result.error }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Unstage file
    ipcMain.handle('git:unstageFile', async (_event, cwd: string, filePath: string) => {
        try {
            const result = await gitService.unstageFile(cwd, filePath)
            return { success: result.success, error: result.error }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get detailed status with file types
    ipcMain.handle('git:getDetailedStatus', async (_event, cwd: string) => {
        try {
            // Get staged files
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --name-status')
            // Get unstaged files
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --name-status')

            const parseStatus = (output: string): Array<{ status: string; path: string; staged: boolean }> => {
                if (!output) {return []}
                return output.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.trim().split('\t')
                        if (parts.length >= 2) {
                            return {
                                status: parts[0],
                                path: parts[1],
                                staged: false
                            }
                        }
                        return null
                    })
                    .filter(Boolean) as Array<{ status: string; path: string; staged: boolean }>
            }

            const stagedFiles = parseStatus(stagedResult.stdout || '').map(f => ({ ...f, staged: true }))
            const unstagedFiles = parseStatus(unstagedResult.stdout || '')

            return {
                success: true,
                stagedFiles,
                unstagedFiles,
                allFiles: [...stagedFiles, ...unstagedFiles]
            }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), stagedFiles: [], unstagedFiles: [], allFiles: [] }
        }
    })

    // Checkout branch
    ipcMain.handle('git:checkout', async (_event, cwd: string, branch: string) => {
        try {
            const result = await gitService.checkout(cwd, branch)
            return { success: result.success, error: result.error }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Commit changes
    ipcMain.handle('git:commit', async (_event, cwd: string, message: string) => {
        try {
            const result = await gitService.commit(cwd, message)
            return { success: result.success, error: result.error }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Push to remote
    ipcMain.handle('git:push', async (_event, cwd: string, remote: string = 'origin', branch?: string) => {
        try {
            if (!branch) {
                const branchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD')
                branch = branchResult.success && branchResult.stdout ? branchResult.stdout.trim() : 'main'
            }
            const result = await gitService.push(cwd, remote, branch)
            return { success: result.success, error: result.error, stdout: result.stdout, stderr: result.stderr }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Pull from remote
    ipcMain.handle('git:pull', async (_event, cwd: string) => {
        try {
            const result = await gitService.pull(cwd)
            return { success: result.success, error: result.error, stdout: result.stdout, stderr: result.stderr }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) }
        }
    })

    // Get remote info
    ipcMain.handle('git:getRemotes', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'remote -v')
            if (result.success && result.stdout) {
                const remotes: Array<{ name: string; url: string; fetch: boolean; push: boolean }> = []
                const lines = result.stdout.split('\n').filter(line => line.trim())
                const remoteMap = new Map<string, { url?: string; fetch: boolean; push: boolean }>()

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/)
                    if (parts.length >= 3) {
                        const name = parts[0]
                        const url = parts[1]
                        const type = parts[2]

                        if (!remoteMap.has(name)) {
                            remoteMap.set(name, { url, fetch: false, push: false })
                        }

                        const remote = remoteMap.get(name)!
                        remote.url = url
                        if (type === '(fetch)') {remote.fetch = true}
                        if (type === '(push)') {remote.push = true}
                    }
                })

                remoteMap.forEach((value, name) => {
                    if (value.url) {
                        remotes.push({ name, url: value.url, fetch: value.fetch, push: value.push })
                    }
                })

                return { success: true, remotes }
            }
            return { success: true, remotes: [] }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), remotes: [] }
        }
    })

    // Get tracking branch info (ahead/behind)
    ipcMain.handle('git:getTrackingInfo', async (_event, cwd: string) => {
        try {
            const branchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD')
            if (!branchResult.success || !branchResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 }
            }

            const branch = branchResult.stdout.trim()
            const trackingResult = await gitService.executeRaw(cwd, `rev-parse --abbrev-ref ${branch}@{upstream}`)

            if (!trackingResult.success || !trackingResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 }
            }

            const tracking = trackingResult.stdout.trim()
            const countsResult = await gitService.executeRaw(cwd, `rev-list --left-right --count ${branch}...${tracking}`)

            if (countsResult.success && countsResult.stdout) {
                const [ahead, behind] = countsResult.stdout.trim().split('\t').map(Number)
                return { success: true, tracking, ahead: ahead || 0, behind: behind || 0 }
            }

            return { success: true, tracking, ahead: 0, behind: 0 }
        } catch (error) {
            return { success: true, tracking: null, ahead: 0, behind: 0 }
        }
    })

    // Get commit statistics (for contribution graph)
    ipcMain.handle('git:getCommitStats', async (_event, cwd: string, days: number = 365) => {
        try {
            const result = await gitService.executeRaw(cwd, `log --since="${days} days ago" --pretty=format:"%ad" --date=short`)
            if (result.success && result.stdout) {
                const dates = result.stdout.split('\n').filter(line => line.trim())
                const commitCounts: Record<string, number> = {}

                dates.forEach(date => {
                    commitCounts[date] = (commitCounts[date] || 0) + 1
                })

                return { success: true, commitCounts }
            }
            return { success: true, commitCounts: {} }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), commitCounts: {} }
        }
    })

    // Get diff statistics (lines added/deleted)
    ipcMain.handle('git:getDiffStats', async (_event, cwd: string) => {
        try {
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --numstat')
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --numstat')

            const parseStats = (output: string): { added: number; deleted: number; files: number } => {
                if (!output) {return { added: 0, deleted: 0, files: 0 }}
                const lines = output.split('\n').filter(line => line.trim())
                let added = 0
                let deleted = 0

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/)
                    if (parts.length >= 2) {
                        const add = parseInt(parts[0]) || 0
                        const del = parseInt(parts[1]) || 0
                        added += add
                        deleted += del
                    }
                })

                return { added, deleted, files: lines.length }
            }

            const stagedStats = parseStats(stagedResult.stdout || '')
            const unstagedStats = parseStats(unstagedResult.stdout || '')

            return {
                success: true,
                staged: stagedStats,
                unstaged: unstagedStats,
                total: {
                    added: stagedStats.added + unstagedStats.added,
                    deleted: stagedStats.deleted + unstagedStats.deleted,
                    files: stagedStats.files + unstagedStats.files
                }
            }
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), staged: { added: 0, deleted: 0, files: 0 }, unstaged: { added: 0, deleted: 0, files: 0 }, total: { added: 0, deleted: 0, files: 0 } }
        }
    })
}
