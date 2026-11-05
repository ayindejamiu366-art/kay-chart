import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin supplies the automatic JSX runtime for `.jsx` sources.
  // Without it, server-side component tests fail with "React is not defined".
  // It is already a devDependency for the app build, so this adds no new package.
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000,
    // `.jsx` is included so component tests (currently the skeleton system)
    // can be rendered with react-dom/server. Those tests need no DOM.
    include: ['tests/**/*.test.{js,jsx,cjs,mjs}'],
  },
});