import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  build: {
    rollupOptions: {
      input: {
        // index.html = page serveurs (racine du site clickone-serveurs)
        index: fileURLToPath(new URL("index.html", import.meta.url)),
        // menu.html = menu client (servi par clickone-menu)
        menu: fileURLToPath(new URL("menu.html", import.meta.url)),
        table7: fileURLToPath(new URL("table7.html", import.meta.url)),
        staff: fileURLToPath(new URL("staff.html", import.meta.url)),
      },
    },
  },
  plugins: [react()],
});
