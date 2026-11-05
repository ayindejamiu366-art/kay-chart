import js from '@eslint/js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Audio: 'readonly',
        Image: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        MediaMetadata: 'readonly',
        AbortSignal: 'readonly',
        indexedDB: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Blob: 'readonly',
        crypto: 'readonly',
        gsap: 'readonly',
        FileReader: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'android/', '*.cjs', 'server/'],
  },
];
