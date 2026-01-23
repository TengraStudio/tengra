import { useCallback, useEffect, useState } from 'react'
import { Project } from '@shared/types/project'

export function useGitData(project: Project) {
    const [gitData, setGitData] = useState<{
        branch: string | null
        isClean: boolean | null
        lastCommit: { hash: string; message: string; author: string; relativeTime: string } | null
        recentCommits: Array<{ hash: string; message: string; author: string; date: string }>
        isRepository: boolean
        loading: boolean
        changedFiles: Array<{ status: string; path: string; staged: boolean }>
        stagedFiles: Array<{ status: string; path: string; staged: boolean }>
        unstagedFiles: Array<{ status: string; path: string; staged: boolean }>
    }>({
        branch: null,
        isClean: null,
        lastCommit: null,
        recentCommits: [],
        isRepository: false,
        loading: false,
        changedFiles: [],
        stagedFiles: [],
        unstagedFiles: []
    })
    const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null)
    const [fileDiff, setFileDiff] = useState<{ original: string; modified: string } | null>(null)
    const [loadingDiff, setLoadingDiff] = useState(false)

    // Additional Git State
    const [branches, setBranches] = useState<string[]>([])
    const [remotes, setRemotes] = useState<Array<{ name: string; url: string; fetch: boolean; push: boolean }>>([])
    const [trackingInfo, setTrackingInfo] = useState<{ tracking: string | null; ahead: number; behind: number } | null>(null)
    const [diffStats, setDiffStats] = useState<{
        staged: { added: number; deleted: number; files: number };
        unstaged: { added: number; deleted: number; files: number };
        total: { added: number; deleted: number; files: number }
    } | null>(null)
    const [commitStats, setCommitStats] = useState<Record<string, number>>({})
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isPushing, setIsPushing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [isCheckingOut, setIsCheckingOut] = useState(false)

    const fetchGitData = useCallback(async () => {
        if (!project.path) { return }

        setGitData(prev => ({ ...prev, loading: true }))
        try {
            // Check if it's a git repository
            const repoCheck = await window.electron.git.isRepository(project.path)
            if (!repoCheck.isRepository) {
                setGitData({
                    branch: null,
                    isClean: null,
                    lastCommit: null,
                    recentCommits: [],
                    isRepository: false,
                    loading: false,
                    changedFiles: [],
                    stagedFiles: [],
                    unstagedFiles: []
                })
                return
            }

            // Fetch all git data in parallel
            const [branchResult, statusResult, lastCommitResult, recentCommitsResult, detailedStatus, branchesResult, remotesResult, trackingResult, diffStatsResult, commitStatsResult] = await Promise.all([
                window.electron.git.getBranch(project.path),
                window.electron.git.getStatus(project.path),
                window.electron.git.getLastCommit(project.path),
                window.electron.git.getRecentCommits(project.path, 10),
                window.electron.git.getDetailedStatus(project.path),
                window.electron.git.getBranches(project.path),
                window.electron.git.getRemotes(project.path),
                window.electron.git.getTrackingInfo(project.path),
                window.electron.git.getDiffStats(project.path),
                window.electron.git.getCommitStats(project.path, 365)
            ])

            setGitData({
                branch: branchResult.success ? (branchResult.branch ?? null) : null,
                isClean: statusResult.success ? (statusResult.isClean ?? null) : null,
                lastCommit: lastCommitResult.success && lastCommitResult.hash
                    ? {
                        hash: lastCommitResult.hash,
                        message: lastCommitResult.message ?? '',
                        author: lastCommitResult.author ?? '',
                        relativeTime: lastCommitResult.relativeTime ?? ''
                    }
                    : null,
                recentCommits: recentCommitsResult.success ? (recentCommitsResult.commits ?? []) : [],
                isRepository: true,
                loading: false,
                changedFiles: detailedStatus.success ? (detailedStatus.allFiles ?? []) : [],
                stagedFiles: detailedStatus.success ? (detailedStatus.stagedFiles ?? []) : [],
                unstagedFiles: detailedStatus.success ? (detailedStatus.unstagedFiles ?? []) : []
            })

            setBranches(branchesResult.success ? (branchesResult.branches ?? []) : [])
            setRemotes(remotesResult.success ? (remotesResult.remotes ?? []) : [])
            setTrackingInfo(trackingResult.success ? { tracking: trackingResult.tracking ?? null, ahead: trackingResult.ahead ?? 0, behind: trackingResult.behind ?? 0 } : null)
            setDiffStats(diffStatsResult.success ? {
                staged: diffStatsResult.staged ?? { added: 0, deleted: 0, files: 0 },
                unstaged: diffStatsResult.unstaged ?? { added: 0, deleted: 0, files: 0 },
                total: diffStatsResult.total ?? { added: 0, deleted: 0, files: 0 }
            } : null)
            setCommitStats(commitStatsResult.success ? (commitStatsResult.commitCounts ?? {}) : {})
        } catch (error) {
            console.error('Failed to fetch git data:', error)
            setGitData(prev => ({ ...prev, loading: false }))
        }
    }, [project.path])

    const loadFileDiff = useCallback(async (filePath: string, staged: boolean) => {
        if (!project.path) { return }

        setLoadingDiff(true)
        try {
            const result = await window.electron.git.getFileDiff(project.path, filePath, staged)
            if (result.success) {
                setFileDiff({
                    original: result.original,
                    modified: result.modified
                })
            }
        } catch (error) {
            console.error('Failed to load file diff:', error)
        } finally {
            setLoadingDiff(false)
        }
    }, [project.path])

    const handleGitFileSelect = useCallback(async (file: { status: string; path: string; staged: boolean }) => {
        setSelectedFile(file)
        await loadFileDiff(file.path, file.staged)
    }, [loadFileDiff])

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return }

        try {
            const result = await window.electron.git.stageFile(project.path, filePath)
            if (result.success) {
                await fetchGitData()
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: true })
                    await loadFileDiff(filePath, true)
                }
            }
        } catch (error) {
            console.error('Failed to stage file:', error)
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff])

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return }

        try {
            const result = await window.electron.git.unstageFile(project.path, filePath)
            if (result.success) {
                await fetchGitData()
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: false })
                    await loadFileDiff(filePath, false)
                }
            }
        } catch (error) {
            console.error('Failed to unstage file:', error)
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff])

    const handleCheckout = useCallback(async (branch: string) => {
        if (!project.path) { return }

        setIsCheckingOut(true)
        try {
            const result = await window.electron.git.checkout(project.path, branch)
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to checkout branch:', result.error)
            }
        } catch (error) {
            console.error('Failed to checkout branch:', error)
        } finally {
            setIsCheckingOut(false)
        }
    }, [project.path, fetchGitData])

    const handleCommit = useCallback(async () => {
        if (!project.path || !commitMessage.trim()) { return }

        setIsCommitting(true)
        try {
            const result = await window.electron.git.commit(project.path, commitMessage.trim())
            if (result.success) {
                setCommitMessage('')
                await fetchGitData()
            } else {
                console.error('Failed to commit:', result.error)
            }
        } catch (error) {
            console.error('Failed to commit:', error)
        } finally {
            setIsCommitting(false)
        }
    }, [project.path, commitMessage, fetchGitData])

    const handlePush = useCallback(async () => {
        if (!project.path) { return }

        setIsPushing(true)
        try {
            const result = await window.electron.git.push(project.path, 'origin')
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to push:', result.error)
            }
        } catch (error) {
            console.error('Failed to push:', error)
        } finally {
            setIsPushing(false)
        }
    }, [project.path, fetchGitData])

    const handlePull = useCallback(async () => {
        if (!project.path) { return }

        setIsPulling(true)
        try {
            const result = await window.electron.git.pull(project.path)
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to pull:', result.error)
            }
        } catch (error) {
            console.error('Failed to pull:', error)
        } finally {
            setIsPulling(false)
        }
    }, [project.path, fetchGitData])

    return {
        gitData,
        selectedFile,
        fileDiff,
        loadingDiff,
        branches,
        remotes,
        trackingInfo,
        diffStats,
        commitStats,
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        fetchGitData,
        handleGitFileSelect,
        handleStageFile,
        handleUnstageFile,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull
    }
}
