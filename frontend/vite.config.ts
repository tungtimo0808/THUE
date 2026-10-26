import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
      "/api": process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 2601,
    allowedHosts: true,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080",
    },
  },
  build: {
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
