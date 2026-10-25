import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { alignKitBindingsSdk } from "./kit-sdk-alignment.mts";

export default defineConfig({
  plugins: [alignKitBindingsSdk(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
  },
});
