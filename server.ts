import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import multer from "multer";
import { generateBarcodeData, validateBarcode, BarcodeType } from "./src/lib/barcode-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

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

  // Bulk Import API via File Upload
  app.post("/api/import", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const fileName = req.file.originalname.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCsv && !isExcel) {
      return res.status(400).json({ error: "Please upload a CSV or Excel file." });
    }

    let rawData: any[] = [];

    try {
      if (isCsv) {
        const csvString = req.file.buffer.toString("utf8");
        const results = Papa.parse(csvString, {
          header: true,
          skipEmptyLines: true
        });
        rawData = results.data;
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet);
      }
    } catch (error) {
      return res.status(500).json({ error: "Error parsing file." });
    }

    const dom = new JSDOM();
    const processedResults = rawData.map((row: any) => {
      const val = row.Value || row.value || row.VALUE;
      const name = row.Name || row.name || row.NAME || "Imported Barcode";
      const standard = row.Standard || row.standard || row.STANDARD;

      if (!val) return null;

      let type: BarcodeType = "CODE128";
      const s = String(standard || "").toUpperCase().trim();
      if (s === "EAN13" || s === "EAN-13") type = "EAN13";
      else if (s === "UPC" || s === "UPC-A") type = "UPC";
      else if (s === "C128" || s === "CODE128") type = "CODE128";

      const isValid = validateBarcode(String(val), type);
      let barcodeData = null;
      if (isValid) {
        try {
          barcodeData = generateBarcodeData(String(val), type, dom.window.document);
        } catch (e) {}
      }

      return {
        input: {
          value: String(val),
          name: name,
          standard: s
        },
        type,
        isValid,
        data: barcodeData
      };
    }).filter(Boolean);

    res.json({
      count: processedResults.length,
      results: processedResults
    });
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
