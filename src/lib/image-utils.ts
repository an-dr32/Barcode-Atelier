export interface ImageProcessingResult {
  silhouette: string; // SVG path data
  width: number;
  height: number;
  warnings: string[];
}

export async function processImage(file: File): Promise<ImageProcessingResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Resize to a manageable size for processing
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = (h * maxDim) / w;
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = (w * maxDim) / h;
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const warnings: string[] = [];

        // 1. Thresholding & Binarization
        // Simple luminance threshold
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // If transparent, treat as white
          if (a < 128) {
            data[i] = data[i+1] = data[i+2] = 255;
          } else {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const val = gray > 128 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = val;
          }
          data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        // 2. Simple Silhouette Extraction (Trace top and bottom edges)
        // For a true "Barcode Atelier" effect, we want to map the barcode lines
        // between a top boundary and a bottom boundary.
        // We'll return the top and bottom edge points.
        
        const topEdges: number[] = new Array(w).fill(0);
        const bottomEdges: number[] = new Array(w).fill(h);

        for (let x = 0; x < w; x++) {
          // Find first black pixel from top
          for (let y = 0; y < h; y++) {
            const idx = (y * w + x) * 4;
            if (data[idx] === 0) {
              topEdges[x] = y;
              break;
            }
          }
          // Find first black pixel from bottom
          for (let y = h - 1; y >= 0; y--) {
            const idx = (y * w + x) * 4;
            if (data[idx] === 0) {
              bottomEdges[x] = y;
              break;
            }
          }
        }

        // Check for complexity
        let transitions = 0;
        for (let x = 1; x < w; x++) {
          if (Math.abs(topEdges[x] - topEdges[x-1]) > 10) transitions++;
        }
        if (transitions > 20) {
          warnings.push("Image is too detailed, consider a simpler silhouette.");
        }

        // Create a simple SVG path for the silhouette for preview
        let pathData = `M 0 ${topEdges[0]}`;
        for (let x = 1; x < w; x++) pathData += ` L ${x} ${topEdges[x]}`;
        for (let x = w - 1; x >= 0; x--) pathData += ` L ${x} ${bottomEdges[x]}`;
        pathData += ' Z';

        resolve({
          silhouette: pathData,
          width: w,
          height: h,
          warnings
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function getWarpedPoints(
  x: number, 
  y: number, 
  canvasWidth: number, 
  canvasHeight: number, 
  silhouettePath: string | null,
  safeZonePercent: number = 0.3
) {
  // If no silhouette, return original
  if (!silhouettePath) return { x, y };

  // This is a simplified warping. 
  // In a real implementation, we'd parse the silhouette path or use the edge arrays.
  // For now, let's assume a simple "bottle" or "mountain" shape if no silhouette is provided,
  // or use a more advanced mapping if it is.
  
  return { x, y };
}
