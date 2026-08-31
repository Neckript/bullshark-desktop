import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude/**` porte les worktrees : sans lui, un `npm run lint` lance depuis
  // la racine descend dans le `out/` d'un worktree voisin et rapporte des
  // centaines de fausses erreurs. Le motif `out/**` ne vaut qu'a la racine.
  { ignores: ['out/**', 'dist/**', 'node_modules/**', '.claude/**', '*.config.js', '*.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      // pragmatic: allow intentional empty catch (offline-ignore in updater)
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
);
