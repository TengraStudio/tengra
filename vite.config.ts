import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

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
                                'ssh2'
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
        renderer()
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src/renderer'),
            '@main': resolve(__dirname, 'src/main'),
            '@renderer': resolve(__dirname, 'src/renderer')
        }
    },
    build: {
        outDir: 'dist/renderer'
    }
})
