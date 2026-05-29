import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route: Get portfolio images
  app.get("/api/portfolio", (req, res) => {
    const portfolioDir = path.join(process.cwd(), "公開用", "portfolio");
    
    if (!fs.existsSync(portfolioDir)) {
      return res.json([]);
    }

    try {
      const files = fs.readdirSync(portfolioDir);
      const images = files
        .filter(file => /\.(png|jpe?g|webp|gif)$/i.test(file))
        .map(file => ({
          filename: file,
          title: path.parse(file).name,
          url: `./portfolio/${file}`
        }));
      res.json(images);
    } catch (error) {
      console.error("Error reading portfolio directory:", error);
      res.status(500).json({ error: "Failed to read portfolio directory" });
    }
  });

  // Serve the 公開用 directory statically at the root so relative images can be loaded
  app.use(express.static(path.join(process.cwd(), "公開用"), { index: false }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
