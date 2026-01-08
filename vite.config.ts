import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
    plugins: [
        react(),
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
        renderer(),
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
            '@renderer': resolve(__dirname, 'src/renderer')
        }
    },
    build: {
        outDir: 'dist/renderer',
        rollupOptions: {
            output: {
                // Manual chunks for code splitting
                manualChunks: {
                    // Monaco Editor - very large, separate chunk
                    'monaco': ['monaco-editor', '@monaco-editor/react'],
                    // React ecosystem
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    // Animation libraries
                    'animation': ['framer-motion'],
                    // Utilities
                    'utils': ['lodash', 'date-fns', 'uuid'],
                    // Icons
                    'icons': ['lucide-react'],
                    // Markdown
                    'markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight']
                }
            }
        },
        // Increase chunk size warning limit
        chunkSizeWarningLimit: 1000
    }
})
