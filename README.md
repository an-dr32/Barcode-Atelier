# Barcode Atelier by Andres De Moya

A modern design tool to generate, customize, and transform barcodes into visually expressive designs while maintaining scan functionality.

## Features

- **Standard Support**: Generate CODE128, EAN13, and UPC barcodes.
- **Visual Transformation**: Distort, wave, and shape barcodes into silhouettes.
- **Text-to-Shape**: Convert any text into a silhouette for barcode mapping.
- **Real-time Scannability**: Live heuristic feedback on whether your design remains scannable.
- **Export**: Save as high-quality PNG or SVG.
- **Bulk Import**: Import dozens of barcodes at once via CSV or Excel with interactive conflict resolution.

---

## Bulk Import Guide

Bulk importing allows you to rapidly create multiple barcodes using data from external files. 

### Supported Formats
*   **CSV** (Comma Separated Values)
*   **XLSX / XLS** (Excel Spreadsheets)

### Required Data Schema
The importer looks for the following column headers (case-insensitive):

| Column | Type | Requirement | Description |
| :--- | :--- | :--- | :--- |
| **Value** | String | Required | The actual data context to encode. |
| **Name** | String | Optional | The label for the barcode (defaults to "Imported Barcode"). |
| **Standard** | String | Optional | The symbology: `C128`, `EAN13`, or `UPC`. |

### Validation & Best Practices

To ensure a smooth import-to-export workflow, follow these standards:

#### 1. Symbology Constraints
*   **CODE 128 (`C128`)**: Accepts full ASCII (letters, numbers, symbols). Ideal for alphanumeric IDs.
*   **EAN-13 (`EAN13`)**: Requires **exactly 13 numeric digits** including a valid check digit. 
*   **UPC-A (`UPC`)**: Requires **exactly 12 numeric digits** including a valid check digit.

#### 2. Interactive Review
If the data in your file doesn't match the assigned standard (e.g., you put "HELLO" in an EAN-13 column), a **Review Modal** will appear. 
*   Use the **"Apply to All"** feature in the modal to quickly fix thousands of rows.
*   You can toggle between standards manually to see which one makes that specific value valid.

---

## Developer Integration

Barcode Atelier can be integrated into other projects via its core library or its REST API.

### 1. Core Library (TypeScript/Node.js)

The core logic is located in `src/lib/barcode-utils.ts`. It is environment-agnostic and can run in the browser or on a server (using `jsdom`).

#### Installation
Ensure you have the dependencies:
```bash
npm install jsbarcode jsdom
```

#### Usage
```typescript
import { generateBarcodeData } from './src/lib/barcode-utils';
import { JSDOM } from 'jsdom';

// On the server:
const dom = new JSDOM();
const data = generateBarcodeData("123456789", "CODE128", dom.window.document);

// In the browser:
const data = generateBarcodeData("123456789", "CODE128");

console.log(data.bars); // Array of {x, width}
```

### 2. REST API (Bulk Generation)

The application includes an Express backend that supports bulk barcode generation.

#### Endpoint: `POST /api/generate`

**Request Body:**
```json
{
  "items": [
    { "text": "123456789012", "type": "EAN13" },
    { "text": "HELLO-WORLD", "type": "CODE128" }
  ]
}
```

**Response Body:**
```json
{
  "results": [
    {
      "input": { "text": "123456789012", "type": "EAN13" },
      "data": {
        "bars": [{ "x": 0, "width": 2 }, ...],
        "binary": "101...",
        "type": "EAN13",
        "text": "123456789012",
        "totalWidth": 95
      },
      "success": true
    }
  ]
}
```

---

## Development

### Setup
```bash
npm install
```

### Run
```bash
npm run dev
```

### Build
```bash
npm run build
```

---

## License
MIT
