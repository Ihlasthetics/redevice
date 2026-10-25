import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { alignKitBindingsSdk } from "./kit-sdk-alignment.mts";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [alignKitBindingsSdk(), react(), tailwindcss()],
});
