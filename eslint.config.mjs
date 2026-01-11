import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'vendor'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // Import sorting rules
            'simple-import-sort/imports': ['warn', {
                groups: [
                    // Node.js builtins
                    ['^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process)(/.*|$)'],
                    // Packages (things that start with a letter (or digit or underscore), or @ followed by a letter)
                    ['^@?\\w'],
                    // Internal packages (aliases starting with @/)
                    ['^@/(.*|$)'],
                    // Parent imports (../)
                    ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
                    // Other relative imports (./)
                    ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
                    // Style imports
                    ['^.+\\.s?css$']
                ]
            }],
            'simple-import-sort/exports': 'warn',
            'sort-imports': 'off', // Turn off default sort-imports to use simple-import-sort
        },
    },
);
