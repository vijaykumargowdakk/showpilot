import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', '**/out'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
