import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 180000, proxyTimeout: 180000,
      },
    },
    watch: {
      ignored: ['**/server/**', '**/dist/**', '**/node_modules/**', '**/*.db', '**/*.db-wal', '**/*.db-shm'],
    },
  },
})
