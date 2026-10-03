import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    // Vendored third-party assets (MediaPipe/Emscripten WASM glue under
    // public/) are generated code, not project source, and were never linted
    // by the previous `next lint` run. Keep them out of scope.
    ignores: ["public/**"],
  },
];

export default eslintConfig;
