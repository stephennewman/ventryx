import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react", "react-dom"]
  },
  build: {
    outDir: "frontend/dist", // Define where the build output should go (for example, `frontend/dist`)
  },
  server: {
    port: 5173, // Ensure Vite runs on port 5173 or the port of your choice
  },
});
