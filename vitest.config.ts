import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "*.config.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
