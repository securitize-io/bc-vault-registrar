import eslint from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
    // Base configuration for all files
    {
        ignores: [
            'node_modules',
            'artifacts',
            'cache',
            'coverage',
            'dist',
            'typechain',
            'typechain-types',
            'hardhat.config.ts',
            '**/*.sol',
        ],
    },

    // Default config for JS/TS files
    {
        files: ['**/*.{js,ts}'],
        languageOptions: {
            globals: {
                ...globals.es2021,
                ...globals.node,
                ...globals.mocha,
            },
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 12,
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...typescript.configs.recommended.rules,
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },

    // Override for Solidity files
    {
        files: ['**/*.sol'],
        rules: {},
    },

    // Apply Prettier config at the end
    prettierConfig,
];
