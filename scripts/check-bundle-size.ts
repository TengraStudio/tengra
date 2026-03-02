/**
 * Performance budget checker for Tengra build output.
 *
 * Compares raw file sizes in dist/ against defined budgets and
 * reports violations. Exits with code 1 if any budget is exceeded.
 *
 * Usage: npx tsx scripts/check-bundle-size.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const DIST_DIR = path.resolve(__dirname, '..', 'dist')

/** Budget definitions in bytes */
interface BudgetRule {
  /** Human-readable label */
  label: string
  /** Glob-like pattern (resolved manually) */
  pattern: string
  /** Maximum allowed size in bytes */
  maxBytes: number
  /** Whether this checks total of all matching files */
  aggregate?: boolean
}

const MB = 1024 * 1024
const KB = 1024

const BUDGETS: BudgetRule[] = [
  {
    label: 'Main bundle',
    pattern: 'dist/main/main-*.js',
    maxBytes: 10 * MB,
  },
  {
    label: 'Main index chunk',
    pattern: 'dist/main/index-*.js',
    maxBytes: 5 * MB,
  },
  {
    label: 'Preload script',
    pattern: 'dist/preload/preload.js',
    maxBytes: 100 * KB,
  },
  {
    label: 'Renderer total',
    pattern: 'dist/renderer/**',
    maxBytes: 15 * MB,
    aggregate: true,
  },
  {
    label: 'Renderer chunk (each)',
    pattern: 'dist/renderer/assets/*.js',
    maxBytes: 6 * MB,
  },
]

/** Recursively collect all files under a directory. */
function walkDir(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else {
      results.push(full)
    }
  }
  return results
}

/**
 * Match files against a simplified glob pattern.
 * Supports `*` (single segment) and `**` (recursive).
 */
function matchFiles(pattern: string): string[] {
  const parts = pattern.split('/')
  const baseParts: string[] = []
  let globStart = -1

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].includes('*')) {
      globStart = i
      break
    }
    baseParts.push(parts[i])
  }

  if (globStart === -1) {
    const full = path.resolve(DIST_DIR, '..', pattern)
    return fs.existsSync(full) ? [full] : []
  }

  const baseDir = path.resolve(DIST_DIR, '..', baseParts.join('/'))
  if (!fs.existsSync(baseDir)) return []

  const isRecursive = parts.some((p) => p === '**')
  const filePattern = parts[parts.length - 1]

  if (isRecursive) {
    return walkDir(baseDir)
  }

  // Single-level glob with wildcard in filename
  const dir = baseDir
  if (!fs.existsSync(dir)) return []

  const regex = new RegExp(
    '^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  )

  return fs
    .readdirSync(dir)
    .filter((f) => regex.test(f))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).isFile())
}

function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`
  return `${bytes} B`
}

interface CheckResult {
  label: string
  file: string
  size: number
  maxBytes: number
  passed: boolean
}

function main(): void {
  if (!fs.existsSync(DIST_DIR)) {
    process.stderr.write('ERROR: dist/ directory not found. Run the build first.\n')
    process.exit(1)
  }

  const results: CheckResult[] = []

  for (const budget of BUDGETS) {
    const files = matchFiles(budget.pattern)

    if (files.length === 0) {
      process.stderr.write(`WARN: No files matched pattern "${budget.pattern}"\n`)
      continue
    }

    if (budget.aggregate) {
      const totalSize = files.reduce((sum, f) => sum + fs.statSync(f).size, 0)
      results.push({
        label: budget.label,
        file: budget.pattern,
        size: totalSize,
        maxBytes: budget.maxBytes,
        passed: totalSize <= budget.maxBytes,
      })
    } else {
      for (const filePath of files) {
        const stat = fs.statSync(filePath)
        const relPath = path.relative(path.resolve(DIST_DIR, '..'), filePath)
        results.push({
          label: budget.label,
          file: relPath,
          size: stat.size,
          maxBytes: budget.maxBytes,
          passed: stat.size <= budget.maxBytes,
        })
      }
    }
  }

  // Print report
  const colFile = 50
  const colSize = 12
  const colBudget = 12
  const colStatus = 8

  process.stdout.write('\n=== Performance Budget Report ===\n\n')
  process.stdout.write(
    `${'File / Rule'.padEnd(colFile)} ${'Size'.padStart(colSize)} ${'Budget'.padStart(colBudget)} ${'Status'.padStart(colStatus)}\n`
  )
  process.stdout.write(`${'-'.repeat(colFile + colSize + colBudget + colStatus + 3)}\n`)

  let hasFailure = false

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    const status = r.passed ? 'OK' : 'OVER'
    const displayFile =
      r.file.length > colFile - 2 ? '…' + r.file.slice(-(colFile - 3)) : r.file

    process.stdout.write(
      `${displayFile.padEnd(colFile)} ${formatSize(r.size).padStart(colSize)} ${formatSize(r.maxBytes).padStart(colBudget)} ${icon} ${status}\n`
    )

    if (!r.passed) hasFailure = true
  }

  process.stdout.write('\n')

  if (hasFailure) {
    process.stderr.write('❌ BUDGET EXCEEDED: One or more bundles are over their size budget.\n')
    process.exit(1)
  }

  process.stdout.write('✅ All bundles are within their performance budgets.\n')
}

main()
