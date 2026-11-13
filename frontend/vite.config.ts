import http from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080";
const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 650,
  maxFreeSockets: 256,
  keepAliveMsecs: 30000,
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 2601,
    allowedHosts: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: false,
        agent: keepAliveAgent,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 2601,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: false,
        agent: keepAliveAgent,
      },
    },
  },
  build: {
    outDir: process.env.VITE_OUT_DIR || "dist",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/xlsx/")) return "vendor-xlsx";
          if (id.includes("node_modules/lucide-react/")) return "vendor-lucide";
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/")) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
