import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/tests/**/*.test.ts', 'src/tests/**/*.spec.ts'],
        exclude: ['node_modules', 'dist', 'out'],
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/main/**/*.ts'],
            exclude: [
                'src/main/**/*.test.ts',
                'src/main/**/types/**',
                'src/main/**/*.d.ts',
                'src/main/preload.ts'
            ],
            // Coverage thresholds - aim for 80%
            thresholds: {
                statements: 60,
                branches: 50,
                functions: 60,
                lines: 60
            }
        },
        testTimeout: 10000,
        hookTimeout: 10000,
        // Better output
        reporters: ['verbose'],
        // Pool for faster tests
        pool: 'threads',

    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer'),
            '@main': path.resolve(__dirname, './src/main'),
            '@shared': path.resolve(__dirname, './src/shared'),
        }
    }
})
