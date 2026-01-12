import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
// import { reactGlobalPlugin } from './vite-plugin-react-global' // Removed causing errors

export default defineConfig({
    plugins: [
        // reactGlobalPlugin(), // Removed
        react({
            jsxRuntime: 'automatic',
            jsxImportSource: 'react',
            // Enable babel to handle .mjs files
            babel: {
                parserOpts: {
                    plugins: ['importMeta', 'topLevelAwait']
                }
            }
        }),
        electron([
            {
                entry: 'src/main/main.ts',
                onstart(options) {
                    options.startup()
                },
                vite: {
                    build: {
                        outDir: 'dist/main',
                        lib: {
                            entry: 'src/main/main.ts',
                            formats: ['cjs']
                        },
                        rollupOptions: {
                            external: [
                                'electron',
                                'fs',
                                'path',
                                'child_process',
                                'util',
                                'os',
                                'http',
                                'https',
                                'events',
                                'stream',
                                'net',
                                'tls',
                                'crypto',
                                'fs/promises',
                                'sql.js',
                                'ssh2',
                                '@lancedb/lancedb',
                                'apache-arrow',
                                'ws',
                                'bufferutil',
                                'utf-8-validate',
                            ]
                        }
                    }
                }
            },
            {
                entry: 'src/main/preload.ts',
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: 'dist/preload',
                        lib: {
                            entry: 'src/main/preload.ts',
                            formats: ['cjs']
                        },
                        rollupOptions: {
                            external: ['electron']
                        }
                    }
                }
            }
        ]),

        // Bundle analyzer - generates stats.html after build
        visualizer({
            filename: 'stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true
        })
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
            '@main': resolve(__dirname, 'src/main'),
            '@renderer': resolve(__dirname, 'src/renderer'),
        },
        // Ensure ESM modules are resolved correctly
        conditions: ['import', 'module', 'browser', 'default'],
        // Handle .mjs extensions properly
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    },
    build: {
        outDir: 'dist/renderer',
        rollupOptions: {
            output: {
                // Manual chunks for code splitting
                manualChunks: (id) => {
                    // Keep it simple for now to avoid breaking React context
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        },
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 2000,
        // Disable minification to avoid CodeMirror class initialization issues
        minify: false,
        // CommonJS interop for ESM modules
        commonjsOptions: {
            include: [/node_modules/],
            transformMixedEsModules: true,
            esmExternals: true,
            strictRequires: false
        },
        // Configure build target
        target: 'es2020',
        sourcemap: true
    },
    // Optimize deps - pre-bundle React and related libs
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            '@floating-ui/react',
            'react-transition-group'
        ],
        esbuildOptions: {
            target: 'es2020',
            keepNames: false,
            jsx: 'automatic',
            jsxImportSource: 'react'
        }
    },
    // Ensure ESM compatibility
    esbuild: {
        target: 'es2020',
        keepNames: false
    },
})
