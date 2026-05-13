import fs from 'fs';
import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
// import { reactGlobalPlugin } from './vite-plugin-react-global' // Removed causing errors

export default defineConfig(({ mode }) => {
    const nodeEnv = process.env.NODE_ENV ?? (mode === 'development' ? 'development' : 'production');
    const isDev = nodeEnv === 'development';
    const shouldAnalyzeBundle = process.env.TENGRA_ANALYZE_BUNDLE === 'true';
    const shouldReportCompressedSize = process.env.TENGRA_REPORT_COMPRESSED_SIZE === 'true';
    const shouldUsePollingWatcher = process.env.TENGRA_VITE_USE_POLLING === 'true';

    const buildTarget = process.env.TENGRA_BUILD_TARGET ?? 'all';
    const isMainOnly = buildTarget === 'main';
    const isRendererOnly = buildTarget === 'renderer';

    const plugins = [
        react(),
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
                            '@assets': resolve(__dirname, 'assets'),
                            '@renderer': resolve(__dirname, 'src/renderer'),
                            '@common': resolve(__dirname, 'src/renderer/common'),
                            '@ui': resolve(__dirname, 'src/renderer/ui'),
                            '@system': resolve(__dirname, 'src/renderer/system'),
                        }
                    },
                        build: {
                            outDir: 'dist/main',
                            emptyOutDir: true,
                        lib: {
                            entry: 'src/main/main.ts',
                            formats: ['cjs'],
                            fileName: () => 'main.js'
                        },
                        minify: isDev ? false : 'oxc',
                        sourcemap: isDev,
                        rollupOptions: {
                            external,
                            treeshake: isDev ? false : {
                                moduleSideEffects: false
                            },
                            output: {
                                inlineDynamicImports: true,
                                entryFileNames: 'main.js'
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
                        '@assets': resolve(__dirname, 'assets'),
                        '@common': resolve(__dirname, 'src/renderer/common'),
                        '@ui': resolve(__dirname, 'src/renderer/ui'),
                        '@system': resolve(__dirname, 'src/renderer/system'),
                    }
                },
                build: {
                    outDir: 'dist/preload',
                    emptyOutDir: true,
                    lib: {
                        entry: 'src/main/preload.ts',
                        formats: ['cjs'],
                        fileName: () => 'preload.js'
                    },
                    minify: isDev ? false : 'oxc',
                    sourcemap: isDev,
                    rollupOptions: {
                        external: ['electron'],
                        treeshake: !isDev,
                        output: {
                            inlineDynamicImports: true
                        }
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

    const getGitHash = () => {
        try {
            return require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
        } catch {
            return 'unknown';
        }
    };

    const appVersion = isDev ? `${pkg.version}-dev.${getGitHash()}` : pkg.version;

    return {
        base: './',
        plugins,
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src/renderer'),
                '@main': resolve(__dirname, 'src/main'),
                '@renderer': resolve(__dirname, 'src/renderer'),
                '@common': resolve(__dirname, 'src/renderer/common'),
                '@ui': resolve(__dirname, 'src/renderer/ui'),
                '@system': resolve(__dirname, 'src/renderer/system'),
                '@shared': resolve(__dirname, 'src/shared'),
                '@assets': resolve(__dirname, 'assets'),
                '@tests': resolve(__dirname, 'src/tests'),
                'path': 'path-browserify',
            },
            // Ensure ESM modules are resolved correctly
            conditions: ['import', 'module', 'browser', 'default'],
            // Handle .mjs extensions properly
            extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
        },
        server: {
            watch: {
                usePolling: shouldUsePollingWatcher,
                interval: shouldUsePollingWatcher ? 1000 : undefined,
                ignored: (p: string) => {
                    const normalized = p.replace(/\\/g, '/');
                    return (
                        normalized.includes('/data/') ||
                        normalized.includes('/dist/') ||
                        normalized.includes('/bin/') ||
                        normalized.includes('/runtime/') ||
                        normalized.includes('/release/') ||
                        normalized.includes('/scratch/') ||
                        normalized.includes('/.agent/') ||
                        normalized.includes('/.gemini/') ||
                        normalized.includes('/.claude/') ||
                        normalized.endsWith('.log') ||
                        normalized.endsWith('vitest-results.json')
                    );
                }
            }
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify(nodeEnv),
            '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
            '__APP_VERSION__': JSON.stringify(appVersion)
        },
        build: isMainOnly ? {
            outDir: 'dist/main',
            emptyOutDir: true,
            lib: {
                entry: 'src/main/main.ts',
                formats: ['cjs'],
                fileName: 'main'
            },
            rollupOptions: { 
                external,
                output: {
                    inlineDynamicImports: true,
                    entryFileNames: 'main.js'
                }
            }
        } : {
            outDir: 'dist/renderer',
            emptyOutDir: true,
            rollupOptions: {
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
                        if (id.includes('node_modules/@tabler/icons-react')) {
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
            minify: isDev ? false : (process.env.TENGRA_BUILD_FAST === 'true' ? false : 'oxc'),
            commonjsOptions: {
                include: [/node_modules/],
                transformMixedEsModules: true,
                esmExternals: true,
                strictRequires: false
            },
            target: 'esnext',
            sourcemap: isDev,
            cssCodeSplit: true,
            cssMinify: isDev ? false : 'esbuild',
            reportCompressedSize: shouldReportCompressedSize
        },
        // Optimize deps - pre-bundle for faster dev startup
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@floating-ui/react',
                '@tabler/icons-react',
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
                'monaco-editor/esm/vs/editor/editor.api.js',
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
            rollupOptions: {
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
