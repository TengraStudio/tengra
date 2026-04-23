import { resolve } from 'path';
import fs from 'fs';

import react from '@vitejs/plugin-react-oxc';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
// import { reactGlobalPlugin } from './vite-plugin-react-global' // Removed causing errors

export default defineConfig(({ mode }) => {
    const nodeEnv = process.env.NODE_ENV ?? (mode === 'development' ? 'development' : 'production');
    const shouldAnalyzeBundle = process.env.TENGRA_ANALYZE_BUNDLE === 'true';
    const shouldReportCompressedSize = process.env.TENGRA_REPORT_COMPRESSED_SIZE === 'true';

    const buildTarget = process.env.TENGRA_BUILD_TARGET ?? 'all';
    const isMainOnly = buildTarget === 'main';
    const isRendererOnly = buildTarget === 'renderer';

    const plugins = [
        react({
            jsxRuntime: 'automatic',
            jsxImportSource: 'react'
        }),
    ];

    const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
    const external = [
        'electron',
        'node-pty',
        'better-sqlite3',
        'ssh2',
        'ws',
        '@primno/dpapi',
        ...Object.keys(pkg.dependencies || {}),
        ...require('module').builtinModules,
        ...require('module').builtinModules.map((m: string) => `node:${m}`),
        /^@discordjs\/.*/,
        'zlib-sync',
        'erlpack'
    ];

    if (!isRendererOnly) {
        const electronEntries: any[] = [];
        
        // Only include main.ts in the plugin if we are NOT doing a parallel main-only build
        if (!isMainOnly) {
            electronEntries.push({
                entry: 'src/main/main.ts',
                onstart(options: any) {
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
                        emptyOutDir: true,
                        lib: {
                            entry: 'src/main/main.ts',
                            formats: ['cjs']
                        },
                        minify: 'esbuild',
                        rollupOptions: {
                            external,
                            treeshake: {
                                preset: 'recommended',
                                moduleSideEffects: false
                            }
                        }
                    }
                }
            });
        }

        // Always include preload.ts in the plugin when building backend
        electronEntries.push({
            entry: 'src/main/preload.ts',
            onstart(options: any) {
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
                    emptyOutDir: true,
                    lib: {
                        entry: 'src/main/preload.ts',
                        formats: ['cjs']
                    },
                    minify: 'esbuild',
                    rollupOptions: {
                        external: ['electron'],
                        treeshake: true
                    }
                }
            }
        });

        plugins.push(electron(electronEntries));
    }

    if (shouldAnalyzeBundle) {
        plugins.push(
            visualizer({
                filename: `dist/stats-${buildTarget}.html`,
                open: false,
                gzipSize: true,
                brotliSize: true
            })
        );
    }

    return {
        plugins,
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
        build: isMainOnly ? {
            outDir: 'dist/main',
            emptyOutDir: false,
            lib: {
                entry: 'src/main/main.ts',
                formats: ['cjs']
            },
            rolldownOptions: { external }
        } : {
            outDir: 'dist/renderer',
            emptyOutDir: true,
            rolldownOptions: {
                treeshake: {
                    moduleSideEffects: 'no-external',
                    propertyReadSideEffects: false,
                    unknownGlobalSideEffects: false
                },
                output: {
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
                    },
                    entryFileNames: 'assets/[name]-[hash].js',
                    chunkFileNames: 'assets/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash].[ext]'
                }
            },
            chunkSizeWarningLimit: 5000,
            minify: process.env.TENGRA_BUILD_FAST === 'true' ? false : 'esbuild',
            commonjsOptions: {
                include: [/node_modules/],
                transformMixedEsModules: true,
                esmExternals: true,
                strictRequires: false
            },
            target: 'esnext',
            sourcemap: false,
            cssCodeSplit: true,
            cssMinify: 'esbuild',
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
                'axios',
                'react-markdown',
                'class-variance-authority',
                'react-virtuoso',
                're-resizable',
                '@dnd-kit/core',
                'react-window',
                'react-file-icon',
                '@xterm/xterm',
                '@xterm/addon-fit',
                '@xterm/addon-webgl',
                '@monaco-editor/react',
                'monaco-editor',
                'monaco-editor/esm/vs/editor/editor.api',
                'monaco-editor/esm/vs/editor/editor.all',
                'monaco-editor/esm/vs/editor/editor.worker',
                'monaco-editor/esm/vs/language/json/json.worker',
                'monaco-editor/esm/vs/language/css/css.worker',
                'monaco-editor/esm/vs/language/html/html.worker',
                'monaco-editor/esm/vs/language/typescript/ts.worker',
                'monaco-editor/esm/vs/language/typescript/monaco.contribution',
                'monaco-editor/esm/vs/basic-languages/monaco.contribution',
                'mermaid',
                'katex',
                'rehype-katex',
                'remark-gfm',
                'remark-math',
                'prism-react-renderer',
                'diff',
                'tailwindcss-animate',
                'zustand',
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
