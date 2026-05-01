import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'renderer',
        globals: true,
        environment: 'jsdom',
        include: ['src/tests/renderer/**/*.test.ts', 'src/tests/renderer/**/*.test.tsx'],
        exclude: ['node_modules', 'dist', 'out'],
        setupFiles: ['./src/tests/renderer/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
            exclude: [
                'src/renderer/**/*.test.ts',
                'src/renderer/**/*.test.tsx',
                'src/renderer/**/types/**',
                'src/renderer/**/*.d.ts',
                'src/renderer/main.tsx' // Entry point
            ],
            // Coverage thresholds for UI components
            thresholds: {
                statements: 70,
                branches: 60,
                functions: 70,
                lines: 70
            }
        },
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: ['verbose'],
        pool: 'threads',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer'),
            '@renderer': path.resolve(__dirname, './src/renderer'),
            '@main': path.resolve(__dirname, './src/main'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@assets': path.resolve(__dirname, './assets'),
        }
    }
});
