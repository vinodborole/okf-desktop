import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' so the built assets load when okf serve hosts ui/dist at '/'.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist" },
});
