import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import { generateBarcodeData, BarcodeType } from "./src/lib/barcode-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Bulk Barcode Generation API
  app.post("/api/generate", (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid request. 'items' must be an array." });
    }

    const dom = new JSDOM();
    const results = items.map((item: { text: string; type: BarcodeType }) => {
      try {
        const data = generateBarcodeData(item.text, item.type, dom.window.document);
        return {
          input: item,
          data,
          success: !!data
        };
      } catch (error) {
        return {
          input: item,
          error: error instanceof Error ? error.message : "Unknown error",
          success: false
        };
      }
    });

    res.json({ results });
  });

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
