import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = path.resolve(__dirname);
const forgeComponentsSrc = path.resolve(
  __dirname,
  "../../packages/forge-components/src"
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@frontend-forge/forge-components": path.resolve(
        forgeComponentsSrc,
        "index.ts"
      )
    }
  },
  server: {
    fs: {
      allow: [appRoot, forgeComponentsSrc]
    }
  }
});
