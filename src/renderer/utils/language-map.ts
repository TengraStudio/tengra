/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Language Mapping Utilities for Monaco Editor
 * Maps file extensions to Monaco language IDs and TextMate scopes
 */

// Monaco's built-in supported languages
export const MONACO_BUILTIN_LANGUAGES = new Set([
    'abap', 'apex', 'azcli', 'bat', 'bicep', 'cameligo', 'clojure', 'coffee',
    'cpp', 'csharp', 'csp', 'css', 'cypher', 'dart', 'dockerfile', 'ecl',
    'elixir', 'flow9', 'freemarker2', 'fsharp', 'go', 'graphql', 'handlebars',
    'hcl', 'html', 'ini', 'java', 'javascript', 'json', 'julia', 'kotlin',
    'less', 'lexon', 'liquid', 'lua', 'm3', 'markdown', 'mdx', 'mips',
    'msdax', 'mysql', 'objective-c', 'pascal', 'pascaligo', 'perl', 'pgsql',
    'php', 'pla', 'plaintext', 'postiats', 'powerquery', 'powershell', 'proto',
    'pug', 'python', 'qsharp', 'r', 'razor', 'redis', 'redshift', 'restructuredtext',
    'ruby', 'rust', 'sb', 'scala', 'scheme', 'scss', 'shell', 'sol', 'sparql',
    'sql', 'st', 'swift', 'systemverilog', 'tcl', 'twig', 'typescript', 'vb',
    'wgsl', 'xml', 'yaml', 'haskell'
]);

// Extension to Monaco language ID mapping
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    // JavaScript / TypeScript
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'jsx': 'javascript', // Monaco doesn't differentiate JSX
    'ts': 'typescript',
    'mts': 'typescript',
    'cts': 'typescript',
    'tsx': 'typescript', // Monaco doesn't differentiate TSX

    // Web
    'html': 'html',
    'htm': 'html',
    'xhtml': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    'vue': 'html', // Best fallback for Vue SFC
    'svelte': 'html', // Best fallback for Svelte

    // Data formats
    'json': 'json',
    'jsonc': 'json',
    'json5': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'svg': 'xml',
    'xsd': 'xml',
    'xsl': 'xml',
    'xslt': 'xml',
    'toml': 'ini', // Best fallback
    'ini': 'ini',
    'env': 'ini',
    'properties': 'ini',
    'cfg': 'ini',
    'conf': 'ini',

    // Python
    'py': 'python',
    'pyw': 'python',
    'pyx': 'python',
    'pyd': 'python',
    'pyi': 'python',
    'ipynb': 'python',

    // Systems languages
    'rs': 'rust',
    'go': 'go',
    'c': 'cpp',
    'h': 'cpp',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'hh': 'cpp',
    'hxx': 'cpp',

    // JVM languages
    'java': 'java',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'clj': 'clojure',
    'cljs': 'clojure',
    'cljc': 'clojure',
    'groovy': 'java', // Best fallback

    // .NET
    'cs': 'csharp',
    'fs': 'fsharp',
    'fsx': 'fsharp',
    'vb': 'vb',

    // Scripting
    'php': 'php',
    'rb': 'ruby',
    'erb': 'ruby',
    'pl': 'perl',
    'pm': 'perl',
    'lua': 'lua',
    'tcl': 'tcl',

    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'psd1': 'powershell',
    'bat': 'bat',
    'cmd': 'bat',

    // Mobile
    'swift': 'swift',
    'dart': 'dart',
    'm': 'objective-c',
    'mm': 'objective-c',

    // Functional
    'ex': 'elixir',
    'exs': 'elixir',
    'hs': 'haskell',
    'lhs': 'haskell',
    'ml': 'fsharp', // OCaml - use F# as fallback
    'mli': 'fsharp',
    'elm': 'plaintext', // Elm - no native support
    'erl': 'plaintext', // Erlang - no native support
    'hrl': 'plaintext',

    // Data science
    'r': 'r',
    'rmd': 'r',
    'jl': 'julia',

    // Blockchain
    'sol': 'sol',

    // Documentation
    'md': 'markdown',
    'mdx': 'mdx',
    'markdown': 'markdown',
    'rst': 'restructuredtext',
    'txt': 'plaintext',
    'text': 'plaintext',

    // GraphQL
    'graphql': 'graphql',
    'gql': 'graphql',

    // Database
    'sql': 'sql',
    'mysql': 'mysql',
    'pgsql': 'pgsql',
    'prisma': 'graphql', // Best visual fallback

    // DevOps
    'dockerfile': 'dockerfile',
    'tf': 'hcl',
    'hcl': 'hcl',
    'proto': 'proto',

    // Templates
    'pug': 'pug',
    'jade': 'pug',
    'hbs': 'handlebars',
    'handlebars': 'handlebars',
    'twig': 'twig',
    'liquid': 'liquid',
    'ejs': 'html',
    'njk': 'html',

    // Other
    'pas': 'pascal',
    'pp': 'pascal',
    'scm': 'scheme',
    'rkt': 'scheme',
    'lisp': 'scheme', // Best fallback
    'v': 'systemverilog',
    'sv': 'systemverilog',
    'vhd': 'plaintext', // VHDL - no native support
    'vhdl': 'plaintext',
    'asm': 'mips', // Best assembly fallback
    's': 'mips',
    'wasm': 'wgsl', // WebAssembly text
    'wat': 'wgsl',
    'wgsl': 'wgsl',

    // Config files
    'editorconfig': 'ini',
    'gitignore': 'plaintext',
    'gitattributes': 'plaintext',
    'dockerignore': 'plaintext',
    'prettierrc': 'json',
    'eslintrc': 'json',
    'npmrc': 'ini',
    'yarnrc': 'yaml',
    'jsonld': 'json',
    'webmanifest': 'json',
    'map': 'json',
    'babelrc': 'json',
};

// Map from short language aliases to Monaco language IDs
export const LANGUAGE_ALIASES: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'rs': 'rust',
    'cs': 'csharp',
    'c#': 'csharp',
    'f#': 'fsharp',
    'go': 'go',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'yml': 'yaml',
    'md': 'markdown',
    'ps': 'powershell',
    'ps1': 'powershell',
    'vb': 'vb',
    'objc': 'objective-c',
    'objective-c': 'objective-c',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'dockerfile': 'dockerfile',
    'docker': 'dockerfile',
    'make': 'shell',
    'makefile': 'shell',
    'cmake': 'shell',
    'proto': 'proto',
    'protobuf': 'proto',
    'tf': 'hcl',
    'terraform': 'hcl',
};

// TextMate scope names for languages that need custom grammar loading
export const TEXTMATE_SCOPES: Record<string, string> = {
    // Languages that Monaco supports but TextMate grammars provide better highlighting
    'vue': 'source.vue',
    'svelte': 'source.svelte',
    'astro': 'source.astro',

    // Languages that Monaco doesn't support natively
    'haskell': 'source.haskell',
    'elm': 'source.elm',
    'erlang': 'source.erlang',
    'ocaml': 'source.ocaml',
    'purescript': 'source.purescript',
    'nim': 'source.nim',
    'zig': 'source.zig',
    'vhdl': 'source.vhdl',
    'nix': 'source.nix',
    'dhall': 'source.dhall',
    'gleam': 'source.gleam',
    'roc': 'source.roc',
};

/**
 * Get Monaco language from file extension
 */
export const getLanguageFromExtension = (filename: string): string => {
    // Handle special filenames first
    const basename = filename.split('/').pop()?.split('\\').pop()?.toLowerCase() ?? '';

    // Special file name mappings
    const specialFiles: Record<string, string> = {
        'dockerfile': 'dockerfile',
        'makefile': 'shell',
        'gnumakefile': 'shell',
        'cmakelists.txt': 'shell',
        'justfile': 'shell',
        'vagrantfile': 'ruby',
        'rakefile': 'ruby',
        'gemfile': 'ruby',
        'podfile': 'ruby',
        'guardfile': 'ruby',
        'fastfile': 'ruby',
        'appfile': 'ruby',
        'procfile': 'yaml',
        '.gitignore': 'plaintext',
        '.gitattributes': 'plaintext',
        '.editorconfig': 'ini',
        '.env': 'ini',
        '.env.local': 'ini',
        '.env.development': 'ini',
        '.env.production': 'ini',
    };

    if (specialFiles[basename]) {
        return specialFiles[basename];
    }

    // Extract extension
    const ext = basename.split('.').pop()?.toLowerCase() ?? '';

    return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext';
};

/**
 * Normalize a language string to Monaco language ID
 * Handles aliases, short forms, and case variations
 */
export const normalizeLanguage = (lang: string): string => {
    if (!lang) {return 'plaintext';}

    const lowerLang = lang.toLowerCase().trim();

    // Check direct alias first
    if (LANGUAGE_ALIASES[lowerLang]) {
        return LANGUAGE_ALIASES[lowerLang];
    }

    // Check if it's already a valid Monaco language
    if (MONACO_BUILTIN_LANGUAGES.has(lowerLang)) {
        return lowerLang;
    }

    // Try extension mapping
    if (EXTENSION_TO_LANGUAGE[lowerLang]) {
        return EXTENSION_TO_LANGUAGE[lowerLang];
    }

    // Return as-is if no mapping found (Monaco will handle unknown gracefully)
    return lowerLang;
};

/**
 * Check if a language is natively supported by Monaco
 */
export const isMonacoNativeLanguage = (lang: string): boolean => {
    const normalized = normalizeLanguage(lang);
    return MONACO_BUILTIN_LANGUAGES.has(normalized);
};

/**
 * Check if a language needs TextMate grammar for proper highlighting
 */
export const needsTextMateGrammar = (lang: string): boolean => {
    const lowerLang = lang.toLowerCase();
    return lowerLang in TEXTMATE_SCOPES;
};

/**
 * Get the TextMate scope for a language
 */
export const getTextMateScope = (lang: string): string | undefined => {
    const lowerLang = lang.toLowerCase();
    return TEXTMATE_SCOPES[lowerLang];
};

export const clearRuntimeLanguageContributions = (): void => {
    // Stub for now
};

export const registerRuntimeLanguageContributions = (packs: unknown[]): void => {
    // Stub for now
};

