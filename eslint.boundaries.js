/**
 * Module Boundary Enforcement Rules
 * Ensures proper separation between main process, renderer process, and shared code.
 */

module.exports = {
    rules: {
        // Prevent renderer from importing main process code
        'no-restricted-imports': [
            'error',
            {
                patterns: [
                    {
                        group: ['**/main/**', '@main/**'],
                        message: 'Renderer process cannot import from main process. Use IPC instead.'
                    },
                    {
                        group: ['electron'],
                        message: 'Use window.electronAPI from preload instead of importing electron directly.'
                    }
                ]
            }
        ]
    },

    // Define module boundaries
    boundaries: {
        // Main process - Node.js environment
        main: {
            path: 'src/main/**',
            allowedImports: ['src/shared/**', 'node_modules/**'],
            disallowedImports: ['src/renderer/**']
        },

        // Renderer process - Browser environment
        renderer: {
            path: 'src/renderer/**',
            allowedImports: ['src/shared/**', 'node_modules/**'],
            disallowedImports: ['src/main/**', 'electron']
        },

        // Shared code - Must be environment-agnostic
        shared: {
            path: 'src/shared/**',
            allowedImports: ['src/shared/**'],
            disallowedImports: ['src/main/**', 'src/renderer/**', 'electron', 'fs', 'path', 'child_process']
        },

        // Preload - Bridge between main and renderer
        preload: {
            path: 'src/main/preload.ts',
            allowedImports: ['electron', 'src/shared/**'],
            disallowedImports: ['src/renderer/**']
        }
    },

    // Feature module boundaries within renderer
    featureBoundaries: {
        // Each feature should be self-contained
        'renderer/features/chat': {
            allowedImports: [
                'src/renderer/components/**',
                'src/renderer/context/**',
                'src/renderer/lib/**',
                'src/renderer/hooks/**',
                'src/shared/**'
            ],
            disallowedImports: [
                'src/renderer/features/projects/**',
                'src/renderer/features/settings/**'
            ]
        },
        'renderer/features/projects': {
            allowedImports: [
                'src/renderer/components/**',
                'src/renderer/context/**',
                'src/renderer/lib/**',
                'src/renderer/hooks/**',
                'src/shared/**'
            ]
        },
        'renderer/features/settings': {
            allowedImports: [
                'src/renderer/components/**',
                'src/renderer/context/**',
                'src/renderer/lib/**',
                'src/renderer/hooks/**',
                'src/shared/**'
            ]
        }
    }
}

/**
 * ESLint overrides for different directories
 * Add these to your eslint.config.js
 */
module.exports.eslintOverrides = [
    // Main process rules
    {
        files: ['src/main/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['**/renderer/**', '@/*'],
                    message: 'Main process cannot import renderer code.'
                }]
            }]
        }
    },
    // Renderer process rules
    {
        files: ['src/renderer/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['**/main/**', '@main/**'],
                        message: 'Use IPC to communicate with main process.'
                    },
                    {
                        group: ['electron'],
                        message: 'Use window.electronAPI from preload.'
                    },
                    {
                        group: ['fs', 'path', 'child_process', 'os'],
                        message: 'Node.js modules not available in renderer. Use IPC.'
                    }
                ]
            }]
        }
    },
    // Shared code rules
    {
        files: ['src/shared/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['electron', 'fs', 'path', 'child_process', 'os', 'crypto'],
                        message: 'Shared code must be environment-agnostic.'
                    },
                    {
                        group: ['react', 'react-dom'],
                        message: 'Shared code should not depend on React.'
                    }
                ]
            }]
        }
    }
]
