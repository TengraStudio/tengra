import { resolve } from 'path'

import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
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
                    // Unset ELECTRON_RUN_AS_NODE to ensure Electron runs properly
                    // This variable may be set by IDE environments like VSCode
                    const env = { ...process.env }
                    delete env.ELECTRON_RUN_AS_NODE
                    void options.startup(['.', '--no-sandbox'], { env })
                },
                vite: {
                    resolve: {
                        alias: {
                            '@main': resolve(__dirname, 'src/main'),
                            '@shared': resolve(__dirname, 'src/shared'),
                            '@renderer': resolve(__dirname, 'src/renderer'),
                        }
                    },
                    build: {
                        outDir: 'dist/main',
                        lib: {
                            entry: 'src/main/main.ts',
                            formats: ['cjs']
                        },
                        minify: false,
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
                                'node-pty',
                                '@electric-sql/pglite',
                                '@electric-sql/pglite/vector',
                                '@primno/dpapi',
                                'ssh2',
                                'better-sqlite3',
                                'ws',
                                'bufferutil',
                                'utf-8-validate'
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
                    resolve: {
                        alias: {
                            '@main': resolve(__dirname, 'src/main'),
                            '@shared': resolve(__dirname, 'src/shared'),
                        }
                    },
                    build: {
                        outDir: 'dist/preload',
                        lib: {
                            entry: 'src/main/preload.ts',
                            formats: ['cjs']
                        },
                        minify: false,
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
            '@shared': resolve(__dirname, 'src/shared'),
        },
        // Ensure ESM modules are resolved correctly
        conditions: ['import', 'module', 'browser', 'default'],
        // Handle .mjs extensions properly
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    },
    define: {
        // Shim Node.js globals for dependencies that expect them in browser context
        '__dirname': '""',
        '__filename': '""',
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        '__BUILD_TIME__': JSON.stringify(new Date().toISOString())
    },
    build: {
        outDir: 'dist/renderer',
        rollupOptions: {
            output: {
                // Better code splitting for faster builds
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        return 'vendor'
                    }
                }
            }
        },
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 2000,
        // Enable minification with esbuild (fast)
        minify: 'esbuild',
        // CommonJS interop for ESM modules
        commonjsOptions: {
            include: [/node_modules/],
            transformMixedEsModules: true,
            esmExternals: true,
            strictRequires: false
        },
        // Configure build target
        target: 'esnext',
        // Disable sourcemaps in production for faster builds
        sourcemap: process.env.NODE_ENV === 'development'
    },
    // Optimize deps - pre-bundle for faster dev startup
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            '@floating-ui/react'
        ],
        // Exclude large deps that don't need pre-bundling
        exclude: ['@lancedb/lancedb', 'apache-arrow'],
        esbuildOptions: {
            target: 'esnext',
            keepNames: false,
            jsx: 'automatic',
            jsxImportSource: 'react'
        }
    },
    // Ensure ESM compatibility
    esbuild: {
        target: 'esnext',
        keepNames: false,
        // Faster transforms
        legalComments: 'none',
        treeShaking: true
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/tests/main/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['src/tests/e2e/**', 'node_modules', 'dist']
    }
})
