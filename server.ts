import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import apiRoutes from "./backend/routes.js";

console.log("SERVER SCRIPT LOADING...");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(compression());
  const PORT = 3000;

  // API Routes
  app.use("/api", apiRoutes);

  // Debug catch-all for /api
  app.use("/api/*", (req, res) => {
    console.log(`Unmatched API request: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });

  // Vite middleware or static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve from dist
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      console.warn("Production mode but 'dist' directory not found. Did you run 'npm run build'?");
      // Fallback to Vite even in production if dist is missing (useful for some preview envs)
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server is listening on 0.0.0.0:${PORT}`);
    console.log(`>>> Environment: ${process.env.NODE_ENV}`);
  });
}

console.log("Calling startServer()...");
startServer().catch(err => {
  console.error("FATAL ERROR STARTING SERVER:", err);
});
