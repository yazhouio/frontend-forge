import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = path.resolve(__dirname);
const forgeComponentsSrc = path.resolve(
  __dirname,
  "../../packages/forge-components/src",
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@frontend-forge/forge-components",
        replacement: path.resolve(forgeComponentsSrc, "index.ts"),
      },
      {
        find: /^@frontend-forge\/forge-components\/(.*)$/,
        replacement: `${forgeComponentsSrc}/$1`,
      },
    ],
  },
  server: {
    fs: {
      allow: [appRoot, forgeComponentsSrc],
    },
    proxy: {
      "^/k?apis": {
        target: "http://139.198.121.90:40880",
        changeOrigin: true,
      },
      "^/clusters/[^/]+/k?apis": {
        target: "http://139.198.121.90:40880",
        changeOrigin: true,
      },
    },
  },
});
