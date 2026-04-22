/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { promises as fs } from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';

const WORKSPACE_IGNORE_CACHE_TTL_MS = 5_000;
const WORKSPACE_IGNORE_FILES = [
    '.gitignore', 
    path.join('.git', 'info', 'exclude'),
] as const;

export const DEFAULT_WORKSPACE_EXPLORER_IGNORE_PATTERNS = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.DS_Store',
] as const;

export const DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS = [
    ...DEFAULT_WORKSPACE_EXPLORER_IGNORE_PATTERNS,
    '.tengra/',
    '.svn/',
    '.hg/',
    'out/',
    '.vscode/',
    '.idea/',
    'coverage/',
    '.nyc_output/',
    'target/',
    'bin/',
    'obj/',
    '.next/',
    '.nuxt/',
    '.cache/',
    '__pycache__/',
    '.pytest_cache/',
    '.output/',
    '.yarn/',
    '.parcel-cache/',
    '.turbo/',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'composer.lock',
    'cargo.lock',
    'go.sum',
    
    // JS/TS
    '.vue/', 
    '.svelte-kit/', 
    '.astro/',
    '.expo/',
    '.yarn/cache/',
    '.yarn/unplugged/',

    // Python
    'venv/',
    '.venv/',
    'env/',
    '.env/',
    'eggs/',
    '.tox/',
    '.mypy_cache/',
    '.hypothesis/',
    'htmlcov/',
    
    // Java/JVM
    '.gradle/',
    'buildSrc/build/',
    '.metadata/',
    
    // PHP & Go & Ruby
    'vendor/',
    'tmp/',
    'var/cache/',
    'var/log/',
    '.bundle/',
    '.ruby-lsp/',
    
    // C# & Unity & C++ & Unreal
    'ipch/',
    'Debug/',
    'Release/',
    'x64/',
    'x86/',
    'Library/',
    'Temp/',
    'Logs/',
    'TestResults/',
    '.vs/',
    'Binaries/',
    'Intermediate/',
    'Saved/',
    
    // iOS/macOS & Android
    'DerivedData/',
    'Pods/',
    '.symlinks/',
    'captures/',
    '.externalNativeBuild/',
    '.cxx/',
    
    // DevOps & Infra
    '.terraform/',
    '.vagrant/',
    '.kitchen/',
    '.serverless/',
    '.aws-sam/',
    '.direnv/',
    
    // Other Ecosystems
    '_build/',
    'deps/',
    '.dart_tool/',
    '.pub-cache/',
    '.elixir_ls/',
    
    // Common build files
    'CMakeCache.txt',
    'CMakeFiles/',
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
] as const;

interface WorkspaceIgnoreRule {
    basenameOnly: boolean;
    negate: boolean;
    regex: RegExp;
}

interface WorkspaceIgnoreCacheEntry {
    expiresAt: number;
    matcher: WorkspaceIgnoreMatcher;
}

export interface WorkspaceIgnoreMatcher {
    rootPath: string;
    patterns: string[];
    ignoresAbsolute: (candidatePath: string) => boolean;
    ignoresRelative: (relativePath: string) => boolean;
}

export interface WorkspaceIgnoreOptions {
    defaultPatterns?: readonly string[];
    extraPatterns?: readonly string[];
}

const workspaceIgnoreCache = new Map<string, WorkspaceIgnoreCacheEntry>();

function normalizeRootPath(rootPath: string): string {
    const resolvedPath = path.resolve(rootPath).replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

function escapeRegExpCharacter(character: string): string {
    return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

function buildGlobPattern(pattern: string): string {
    let result = '';
    for (let index = 0; index < pattern.length; index += 1) {
        const current = pattern[index];
        const next = pattern[index + 1];
        const afterNext = pattern[index + 2];

        if (current === '*' && next === '*') {
            if (afterNext === '/') {
                result += '(?:.*/)?';
                index += 2;
                continue;
            }
            result += '.*';
            index += 1;
            continue;
        }

        if (current === '*') {
            result += '[^/]*';
            continue;
        }

        if (current === '?') {
            result += '[^/]';
            continue;
        }

        result += escapeRegExpCharacter(current);
    }
    return result;
}

function compileIgnoreRule(pattern: string): WorkspaceIgnoreRule | null {
    const trimmedPattern = pattern.trim();
    if (!trimmedPattern || trimmedPattern === '/' || trimmedPattern.startsWith('#')) {
        return null;
    }

    const negate = trimmedPattern.startsWith('!');
    const unwrappedPattern = negate ? trimmedPattern.slice(1).trim() : trimmedPattern;
    if (!unwrappedPattern) {
        return null;
    }

    const normalizedPattern = normalizeRelativePath(
        unwrappedPattern
            .replace(/^\\([#!])/u, '$1')
            .replace(/\/\*\*$/u, '/')
    );
    if (!normalizedPattern) {
        return null;
    }

    const basenameOnly = !normalizedPattern.includes('/');
    const regexSource = buildGlobPattern(normalizedPattern);
    const flags = process.platform === 'win32' ? 'i' : '';
    const regex = basenameOnly
        ? new RegExp(`^${regexSource}$`, flags)
        : new RegExp(`^${regexSource}(?:/.*)?$`, flags);

    return {
        basenameOnly,
        negate,
        regex,
    };
}

function matchesRule(rule: WorkspaceIgnoreRule, relativePath: string): boolean {
    if (!relativePath) {
        return false;
    }

    if (!rule.basenameOnly) {
        return rule.regex.test(relativePath);
    }

    return relativePath.split('/').some(segment => rule.regex.test(segment));
}

function buildWorkspaceIgnoreMatcher(
    rootPath: string,
    patterns: readonly string[]
): WorkspaceIgnoreMatcher {
    const normalizedRootPath = normalizeRootPath(rootPath);
    const rules = patterns
        .map(compileIgnoreRule)
        .filter((rule): rule is WorkspaceIgnoreRule => rule !== null);

    const ignoresRelative = (relativePath: string): boolean => {
        const normalizedRelativePath = normalizeRelativePath(relativePath);
        if (!normalizedRelativePath) {
            return false;
        }

        let ignored = false;
        for (const rule of rules) {
            if (matchesRule(rule, normalizedRelativePath)) {
                ignored = !rule.negate;
            }
        }
        return ignored;
    };

    const ignoresAbsolute = (candidatePath: string): boolean => {
        const normalizedCandidatePath = normalizeRootPath(candidatePath);
        if (
            normalizedCandidatePath !== normalizedRootPath &&
            !normalizedCandidatePath.startsWith(`${normalizedRootPath}/`)
        ) {
            return false;
        }

        const relativePath = normalizedCandidatePath.slice(normalizedRootPath.length);
        return ignoresRelative(relativePath);
    };

    return {
        rootPath: normalizedRootPath,
        patterns: [...patterns],
        ignoresAbsolute,
        ignoresRelative,
    };
}

async function readIgnorePatterns(filePath: string): Promise<string[]> {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        if (typeof content !== 'string') {
            return [];
        }
        return content
            .split(/\r?\n/u)
            .map(line => line.trim())
            .filter(line => line.length > 0);
    } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode !== 'ENOENT' && errorCode !== 'ENOTDIR') {
            appLogger.warn(
                'WorkspaceIgnore',
                `Failed to read ignore file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
        return [];
    }
}

async function loadWorkspaceIgnorePatterns(
    rootPath: string,
    options: WorkspaceIgnoreOptions
): Promise<string[]> {
    const ignoreFilePatterns = await Promise.all(
        WORKSPACE_IGNORE_FILES.map(ignoreFile =>
            readIgnorePatterns(path.join(rootPath, ignoreFile))
        )
    );

    return [
        ...(options.defaultPatterns ?? []),
        ...ignoreFilePatterns.flat(),
        ...(options.extraPatterns ?? []),
    ];
}

function buildCacheKey(rootPath: string, options: WorkspaceIgnoreOptions): string {
    return JSON.stringify({
        rootPath: normalizeRootPath(rootPath),
        defaultPatterns: [...(options.defaultPatterns ?? [])],
        extraPatterns: [...(options.extraPatterns ?? [])],
    });
}

export async function getWorkspaceIgnoreMatcher(
    rootPath: string,
    options: WorkspaceIgnoreOptions = {}
): Promise<WorkspaceIgnoreMatcher> {
    const cacheKey = buildCacheKey(rootPath, options);
    const cachedMatcher = workspaceIgnoreCache.get(cacheKey);
    if (cachedMatcher && cachedMatcher.expiresAt > Date.now()) {
        return cachedMatcher.matcher;
    }

    const patterns = await loadWorkspaceIgnorePatterns(rootPath, options);
    const matcher = buildWorkspaceIgnoreMatcher(rootPath, patterns);
    workspaceIgnoreCache.set(cacheKey, {
        matcher,
        expiresAt: Date.now() + WORKSPACE_IGNORE_CACHE_TTL_MS,
    });
    return matcher;
}

export function clearWorkspaceIgnoreMatcherCache(): void {
    workspaceIgnoreCache.clear();
}
