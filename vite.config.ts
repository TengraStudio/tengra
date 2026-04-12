import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
// import { reactGlobalPlugin } from './vite-plugin-react-global' // Removed causing errors

export default defineConfig(({ mode }) => {
    const nodeEnv = process.env.NODE_ENV ?? (mode === 'development' ? 'development' : 'production');
    const shouldAnalyzeBundle = process.env.TENGRA_ANALYZE_BUNDLE === 'true';
    const shouldReportCompressedSize = process.env.TENGRA_REPORT_COMPRESSED_SIZE === 'true';

    return {
        plugins: [
            // reactGlobalPlugin(), // Removed
            react({
                jsxRuntime: 'automatic',
                jsxImportSource: 'react'
            }),
            electron([
                {
                    entry: 'src/main/main.ts',
                    onstart(options) {
                        // Unset ELECTRON_RUN_AS_NODE to ensure Electron runs properly
                        // This variable may be set by IDE environments like VSCode
                        const env = { ...process.env };
                        delete env.ELECTRON_RUN_AS_NODE;
                        void options.startup(['.', '--no-sandbox'], { env });
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
                            emptyOutDir: true, // UZAY OPTİMİZASYONU: Eski dosyaları temizle
                            lib: {
                                entry: 'src/main/main.ts',
                                formats: ['cjs']
                            },
                            // AGRESIF MİNİFİCATION: Main process'te de minify
                            minify: 'esbuild',
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
                                    '@primno/dpapi',
                                    'ssh2',
                                    'ws',
                                    'bufferutil',
                                    'utf-8-validate',
                                    'better-sqlite3', // Native module
                                    // discord.js and its optional native dependencies
                                    'discord.js',
                                    '@discordjs/ws',
                                    '@discordjs/rest',
                                    '@discordjs/collection',
                                    'zlib-sync',
                                    'erlpack',
                                    '@discordjs/opus',
                                    'sodium',
                                    'sodium-native',
                                    'libsodium-wrappers',
                                ],
                                // UZAY OPTİMİZASYONU: Main process code splitting
                                output: {
                                    // Main process'te manuel chunk zorlaması circular chunk uyarısı
                                    // ürettiği için varsayılan Rollup chunklama stratejisi kullanılıyor.
                                },
                                // AGRESIF tree shaking
                                treeshake: {
                                    preset: 'recommended',
                                    moduleSideEffects: false
                                }
                            }
                        }
                    }
                },
                {
                    entry: 'src/main/preload.ts',
                    onstart(options) {
                        options.reload();
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
                            emptyOutDir: true, // UZAY OPTİMİZASYONU: Eski dosyaları temizle
                            lib: {
                                entry: 'src/main/preload.ts',
                                formats: ['cjs']
                            },
                            // AGRESIF MİNİFİCATION: Preload da minify
                            minify: 'esbuild',
                            rollupOptions: {
                                external: ['electron'],
                                treeshake: true
                            }
                        }
                    }
                }
            ]),
            ...(shouldAnalyzeBundle
                ? [
                    visualizer({
                        filename: 'dist/stats.html',
                        open: false,
                        gzipSize: true,
                        brotliSize: true
                    })
                ]
                : [])
        ],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer'),
                '@main': resolve(__dirname, 'src/main'),
                '@renderer': resolve(__dirname, 'src/renderer'),
                '@shared': resolve(__dirname, 'src/shared'),
                'path': 'path-browserify'
            },
            // Ensure ESM modules are resolved correctly
            conditions: ['import', 'module', 'browser', 'default'],
            // Handle .mjs extensions properly
            extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify(nodeEnv),
            '__BUILD_TIME__': JSON.stringify(new Date().toISOString())
        },
        esbuild: {
            target: 'esnext',
            keepNames: false,
            jsx: 'automatic',
            jsxImportSource: 'react',
            treeShaking: true,
            ...(nodeEnv === 'production'
                ? {
                    drop: ['console', 'debugger'],
                    legalComments: 'none',
                    pure: ['performanceMonitor.mark']
                }
                : {})
        },
        build: {
            outDir: 'dist/renderer',
            // UZAY SEVİYESİ OPTİMİZASYON: Eski build dosyalarını temizle
            emptyOutDir: true,
            rollupOptions: {
                // Rollup cache'ini etkinleştir (hızlı rebuild)
                cache: true,
                // AGRESIF tree shaking
                treeshake: {
                    preset: 'recommended',
                    moduleSideEffects: 'no-external',
                    propertyReadSideEffects: false,
                    unknownGlobalSideEffects: false
                },
                output: {
                    // CODE SPLITTING: Sadece lazy-loadable büyük kütüphaneleri ayır
                    // NOT: React/React-DOM AYRILMAMALI - internal state paylaşımı bozulur
                    manualChunks: (id: string) => {
                        if (id.includes('node_modules/monaco-editor')) {
                            return 'monaco';
                        }
                        if (id.includes('node_modules/@xyflow') || id.includes('node_modules/reactflow')) {
                            return 'react-flow';
                        }
                        if (id.includes('node_modules/prismjs') || id.includes('node_modules/highlight.js') || id.includes('node_modules/prism-react-renderer')) {
                            return 'syntax';
                        }
                        if (id.includes('node_modules/katex') || id.includes('node_modules/rehype-katex')) {
                            return 'katex';
                        }
                        if (id.includes('node_modules/@xterm') || id.includes('node_modules/xterm')) {
                            return 'xterm';
                        }
                        if (id.includes('node_modules/mermaid')) {
                            return 'mermaid';
                        }
                        if (id.includes('node_modules/lucide-react')) {
                            return 'icons';
                        }
                        if (id.includes('node_modules/@dnd-kit')) {
                            return 'dnd';
                        }
                        if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
                            return 'react-vendor';
                        }
                        
                        // Let Rollup/Vite handle the rest naturally for better dynamic chunking
                    },
                    // UZAY OPTİMİZASYONU: Dosya isimlerini hash'le (cache için)
                    entryFileNames: 'assets/[name]-[hash].js',
                    chunkFileNames: 'assets/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash].[ext]'
                }
            },
            // Electron desktop dağıtımında bazı vendor/chunk'lar doğal olarak büyük.
            // 500k uyarı eşiği yerine gerçekçi bir eşik kullanıyoruz.
            chunkSizeWarningLimit: 5000,
            // Build süresi için terser yerine esbuild minifier kullan
            minify: 'esbuild',
            // CommonJS interop
            commonjsOptions: {
                include: [/node_modules/],
                transformMixedEsModules: true,
                esmExternals: true,
                strictRequires: false
            },
            // Modern tarayıcı hedefi (Electron Chromium 120+)
            target: 'esnext',
            // Production'da sourcemap yok (boyut tasarrufu)
            sourcemap: false,
            // CSS code splitting
            cssCodeSplit: true,
            // Sıkıştırılmış boyut raporu pahalı; gerektiğinde env ile açılır.
            reportCompressedSize: shouldReportCompressedSize
        },
        // Optimize deps - pre-bundle for faster dev startup
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@floating-ui/react',
                'lucide-react',
                'clsx',
                'tailwind-merge',
                'date-fns',
                'zod',
                'dompurify',
                '@xyflow/react',
                '@radix-ui/react-checkbox',
                '@radix-ui/react-dialog',
                '@radix-ui/react-dropdown-menu',
                '@radix-ui/react-label',
                '@radix-ui/react-popover',
                '@radix-ui/react-select',
                '@radix-ui/react-slider',
                '@radix-ui/react-slot',
                '@radix-ui/react-switch',
                '@radix-ui/react-tabs',
                '@radix-ui/react-scroll-area',
                '@radix-ui/react-avatar',
                '@radix-ui/react-tooltip',
                '@radix-ui/react-accordion',
                '@radix-ui/react-progress',
                '@radix-ui/react-separator',
                '@radix-ui/react-collapsible',
                'axios',
                'react-markdown',
                'class-variance-authority',
                'react-virtuoso',
                're-resizable',
                '@dnd-kit/core',
                '@dnd-kit/sortable',
                '@dnd-kit/utilities',
                'react-window',
                'react-file-icon',
                '@xterm/xterm',
                '@xterm/addon-fit',
                '@xterm/addon-webgl',
                '@monaco-editor/react',
                'monaco-editor',
                'mermaid',
                'katex',
                'rehype-katex',
                'remark-gfm',
                'remark-math',
                'prism-react-renderer',
                'diff',
                'tailwindcss-animate',
                'framer-motion',
                'zustand',
                'i18next',
                'react-i18next'
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
        test: {
            globals: true,
            environment: 'node',
            include: ['src/tests/main/**/*.{test,spec}.{ts,tsx}'],
            exclude: ['src/tests/e2e/**', 'node_modules', 'dist']
        }
    } as import('vite').UserConfig;
});
