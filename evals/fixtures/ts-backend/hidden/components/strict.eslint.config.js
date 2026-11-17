// Hidden check for the component tasks (components-backend.json): the machine-checkable rules of
// policy/typescript.md, run over production sources only. The untouched fixture passes it, so any
// finding was introduced by the run. `src/lib/logger.ts` holds the fixture's one pre-existing
// assertion (`value as Level`); tests are out of scope.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/*.test.ts",
      "src/test/**",
      "src/__hidden__/**",
      "src/lib/logger.ts",
    ],
  },
  {
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    extends: [tseslint.configs.base],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: false },
      ],
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
);
