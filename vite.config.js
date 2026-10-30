import { defineConfig } from "vite";
export default defineConfig({
  server: { proxy: { "/api": "http://localhost:3001" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"], reactor: ["three"] },
      },
    },
  },
});
