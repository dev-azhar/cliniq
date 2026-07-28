import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// The dev server proxies /api to the FastAPI backend so there are no CORS concerns locally.
export default defineConfig({
    envDir: "..",
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Dev-only: forward API calls to the FastAPI backend to avoid CORS.
            "/api": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            // WebSocket stream for live domain events.
            "/ws": {
                target: "http://127.0.0.1:8000",
                ws: true,
                changeOrigin: true,
            },
        },
    },
});
