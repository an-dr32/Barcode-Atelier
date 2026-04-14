import JsBarcode from 'jsbarcode';

export type BarcodeType = 'CODE128' | 'EAN13' | 'UPC';

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface BarcodeData {
  bars: BarcodeBar[];
  binary: string; // Keep for scannability heuristic
  type: BarcodeType;
  text: string;
  totalWidth: number;
}

export function generateBarcodeData(text: string, type: BarcodeType): BarcodeData | null {
  if (!text) return null;

  if (type === 'EAN13') {
    if (!/^\d{12,13}$/.test(text)) return null;
  } else if (type === 'UPC') {
    if (!/^\d{11,12}$/.test(text)) return null;
  }

  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, text, {
      format: type,
      displayValue: false,
      margin: 0,
    });

    const rects = svg.querySelectorAll('rect');
    const rawBars: BarcodeBar[] = [];
    
    rects.forEach(rect => {
      const fill = rect.getAttribute('fill');
      // JsBarcode bars are black
      if (fill === '#000000' || fill === 'black' || !fill) {
        let x = parseFloat(rect.getAttribute('x') || '0');
        const width = parseFloat(rect.getAttribute('width') || '0');
        
        // Handle transform="translate(x, y)"
        const transform = rect.getAttribute('transform');
        if (transform && transform.includes('translate')) {
          const match = transform.match(/translate\(([^, ]+)[, ]*([^)]+)?\)/);
          if (match) {
            x += parseFloat(match[1]);
          }
        }
        
        // Also check parent groups for transforms
        let parent: Element | null = rect.parentElement;
        while (parent && parent !== (svg as Element)) {
          const pTransform = parent.getAttribute('transform');
          if (pTransform && pTransform.includes('translate')) {
            const pMatch = pTransform.match(/translate\(([^, ]+)[, ]*([^)]+)?\)/);
            if (pMatch) {
              x += parseFloat(pMatch[1]);
            }
          }
          parent = parent.parentElement;
        }

        rawBars.push({ x, width });
      }
    });

    if (rawBars.length === 0) return null;
    rawBars.sort((a, b) => a.x - b.x);

    // Consistently calculate totalWidth from the bars themselves to ensure mapping accuracy
    const minX = rawBars[0].x;
    const maxX = rawBars[rawBars.length - 1].x + rawBars[rawBars.length - 1].width;
    const totalWidth = maxX - minX;

    // Normalize bar x-coordinates to start at 0
    const normalizedBars = rawBars.map(b => ({
      x: b.x - minX,
      width: b.width
    }));

    // For scannability heuristic
    const minWidth = Math.min(...normalizedBars.map(b => b.width));
    let binary = '';
    let currentX = 0;
    normalizedBars.forEach(bar => {
      const gap = bar.x - currentX;
      if (gap > 0.1) {
        binary += '0'.repeat(Math.round(gap / minWidth));
      }
      binary += '1'.repeat(Math.round(bar.width / minWidth));
      currentX = bar.x + bar.width;
    });

    // Extract the actual text JsBarcode used (it might have added a checksum)
    // We can't easily get it from the SVG, but we can re-run JsBarcode with a callback
    // or just assume the input is correct if it passed validation.
    // Actually, JsBarcode's EAN13/UPC implementation usually adds the checksum to the text it displays.
    
    return {
      bars: normalizedBars,
      binary,
      type,
      text: text, // We'll keep the original for now, but ensure it's valid
      totalWidth
    };
  } catch (e) {
    console.error('Barcode generation failed:', e);
    return null;
  }
}

export function calculateScannability(binary: string, distortionFactor: number, safeZoneFactor: number = 0.2): number {
  // Simple heuristic: 100 is perfect, decreases with distortion, increases with safe zone
  const baseScore = 100;
  
  // Distortion penalty is reduced if safe zone is large
  // If safeZone is 1.0, the barcode is perfectly scannable regardless of distortion
  const penalty = distortionFactor * 60 * (1 - safeZoneFactor);
  
  return Math.max(10, Math.min(100, Math.round(baseScore - penalty)));
}
