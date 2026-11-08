import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["**/dist/", "claude-mods/", "docs/", "**/node_modules/", "app/android/", "**/.wrangler/"] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: [".svelte"] } },
  },
  // TypeScript prüft undefinierte Namen selbst (inkl. globaler Typen wie GeoJSON)
  { files: ["**/*.ts", "**/*.svelte"], rules: { "no-undef": "off" } },
  // `const { weg: _, ...rest } = x` zum Weglassen von Feldern
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", ignoreRestSiblings: true }] } },
);
