import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
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
                                'better-sqlite3' // Native module
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
            'path': 'path-browserify'
        },
        // Ensure ESM modules are resolved correctly
        conditions: ['import', 'module', 'browser', 'default'],
        // Handle .mjs extensions properly
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
        '__BUILD_TIME__': JSON.stringify(new Date().toISOString())
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
                    // Monaco Editor (lazy loaded, çok büyük ~4MB)
                    if (id.includes('node_modules/monaco-editor')) {
                        return 'monaco';
                    }
                    // React Flow (lazy loaded, canvas için)
                    if (id.includes('node_modules/@xyflow') || id.includes('node_modules/reactflow')) {
                        return 'react-flow';
                    }
                    // Code highlighting (lazy loaded)
                    if (id.includes('node_modules/prismjs') || id.includes('node_modules/highlight.js')) {
                        return 'syntax';
                    }
                    // Math rendering (KaTeX çok büyük)
                    if (id.includes('node_modules/katex')) {
                        return 'katex';
                    }
                    // Math rendering (lazy loaded, KaTeX çok büyük)
                    if (id.includes('node_modules/katex')) {
                        return 'katex';
                    }
                    // xterm (lazy loaded, terminal için)
                    if (id.includes('node_modules/@xterm') || id.includes('node_modules/xterm')) {
                        return 'xterm';
                    }
                    // Diğer tüm node_modules -> vendor (React dahil, birlikte kalmalı)
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
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
        // AGRESIF MİNİFİCATION: terser kullan (esbuild'den daha iyi sıkıştırma)
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true, // console.log'ları production'da kaldır
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug'], // Belirli fonksiyonları kaldır
                passes: 2 // İki kez optimize et
            },
            mangle: {
                safari10: true // Safari uyumluluğu
            },
            format: {
                comments: false // Yorumları kaldır
            }
        },
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
        // UZAY OPTİMİZASYONU: Daha agresif tree shaking
        reportCompressedSize: true
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
} as import('vite').UserConfig);
