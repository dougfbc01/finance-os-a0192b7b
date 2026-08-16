import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config";
import viteConfigFactory from "./vite.config";

const viteConfig = (viteConfigFactory as (() => ViteUserConfig))();

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
    },
  }),
);
