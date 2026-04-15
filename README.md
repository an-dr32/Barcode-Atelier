# Barcode Atelier by Andres De Moya

A modern design tool to generate, customize, and transform barcodes into visually expressive designs while maintaining scan functionality.

## Features

- **Standard Support**: Generate CODE128, EAN13, and UPC barcodes.
- **Visual Transformation**: Distort, wave, and shape barcodes into silhouettes.
- **Text-to-Shape**: Convert any text into a silhouette for barcode mapping.
- **Real-time Scannability**: Live heuristic feedback on whether your design remains scannable.
- **Export**: Save as high-quality PNG or SVG.

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
