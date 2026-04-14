import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarcodeData } from '../lib/barcode-utils';

interface BarcodeCanvasProps {
  data: BarcodeData | null;
  silhouette: string | null;
  distortion: number;
  safeZone: number;
  barcodeHeight?: number; // New prop
  color: string;
  backgroundColor: string;
  showSafeZone: boolean;
  error?: string | null;
}

export const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({
  data,
  silhouette,
  distortion,
  safeZone,
  barcodeHeight = 150, // Default increased from 100
  color,
  backgroundColor,
  showSafeZone,
  error
}) => {
  const [silhouetteData, setSilhouetteData] = useState<{
    segments: { start: number; end: number }[][];
    minX: number;
    maxX: number;
  } | null>(null);

  const bars = useMemo(() => {
    if (!data) return [];
    return data.bars;
  }, [data]);

  // Sample the silhouette (path or image) to find vertical segments
  useEffect(() => {
    if (!silhouette) {
      setSilhouetteData(null);
      return;
    }

    const width = 400;
    const height = 400;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const processCanvas = () => {
      const imageData = ctx.getImageData(0, 0, width, height);
      const dataArr = imageData.data;
      const segments: { start: number; end: number }[][] = new Array(width).fill(null).map(() => []);
      
      let minX = width, maxX = 0;
      let hasPixels = false;

      for (let x = 0; x < width; x++) {
        let inSeg = false;
        let startY = 0;
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4;
          // Check for black pixels
          // For SVG paths: alpha > 50
          // For binarized images: luminance < 128
          const r = dataArr[idx];
          const g = dataArr[idx + 1];
          const b = dataArr[idx + 2];
          const a = dataArr[idx + 3];
          const isBlack = a > 50 && (r + g + b) / 3 < 128;
          
          if (isBlack) {
            hasPixels = true;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            if (!inSeg) {
              inSeg = true;
              startY = y;
            }
          } else if (inSeg) {
            inSeg = false;
            segments[x].push({ start: startY / height, end: y / height });
          }
        }
        if (inSeg) segments[x].push({ start: startY / height, end: 1 });
      }

      if (!hasPixels) {
        setSilhouetteData(null);
      } else {
        setSilhouetteData({ segments, minX, maxX });
      }
    };

    if (silhouette.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        const scale = Math.min(width / img.width, height / img.height) * 0.95;
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        processCanvas();
      };
      img.src = silhouette;
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'black';
      try {
        const path = new Path2D(silhouette);
        
        // Find bounds of path to auto-scale
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.fill(path);
          const tempImgData = tempCtx.getImageData(0, 0, width, height);
          let sMinX = width, sMaxX = 0, sMinY = height, sMaxY = 0;
          let sHasPixels = false;
          for (let i = 0; i < tempImgData.data.length; i += 4) {
            if (tempImgData.data[i + 3] > 50) {
              const idx = i / 4;
              const px = idx % width;
              const py = Math.floor(idx / width);
              sMinX = Math.min(sMinX, px);
              sMaxX = Math.max(sMaxX, px);
              sMinY = Math.min(sMinY, py);
              sMaxY = Math.max(sMaxY, py);
              sHasPixels = true;
            }
          }
          
          if (sHasPixels) {
            const sWidth = sMaxX - sMinX;
            const sHeight = sMaxY - sMinY;
            const scale = Math.min(width / (sWidth || 1), height / (sHeight || 1)) * 0.95;
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(sMinX + sWidth / 2), -(sMinY + sHeight / 2));
            ctx.fill(path);
            ctx.restore();
          } else {
            ctx.fill(path);
          }
        }
        processCanvas();
      } catch (e) {
        console.error('Invalid silhouette path:', e);
        setSilhouetteData(null);
      }
    }
  }, [silhouette]);

  const viewBoxWidth = data ? Math.max(120, data.totalWidth + 40) : 120;
  const viewBoxHeight = barcodeHeight + 30; // Dynamic height
  const padding = (viewBoxWidth - (data?.totalWidth || 0)) / 2;

  const safeDistortion = (typeof distortion === 'number' && !isNaN(distortion)) ? distortion : 0.5;
  const safeSafeZone = (typeof safeZone === 'number' && !isNaN(safeZone)) ? safeZone : 0.2;

  return (
    <div className="relative w-full aspect-square max-w-2xl mx-auto bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-zinc-200 flex items-center justify-center p-12 transition-all duration-500" style={{ backgroundColor }}>
      {data ? (
        <div className="w-full h-full flex flex-col items-center">
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            id="barcode-svg"
            shapeRendering="crispEdges"
          >
            <defs>
              <clipPath id="barcode-clip">
                <rect x="0" y="0" width={viewBoxWidth} height={barcodeHeight} />
              </clipPath>
            </defs>

            {/* Background for contrast and quiet zone */}
            <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="white" />

            {/* Barcode Bars */}
            <g clipPath="url(#barcode-clip)">
              {bars.map((bar, idx) => {
                const totalWidth = data.totalWidth || 1;
                const xPos = (bar.x + bar.width / 2) / totalWidth; // Use center of bar for sampling
                
                let finalSegments: { start: number; end: number }[] = [];

                if (silhouetteData) {
                  const { segments, minX, maxX } = silhouetteData;
                  const rangeX = maxX - minX;
                  const silhouetteX = rangeX > 0 ? minX + xPos * rangeX : minX;
                  const sampleIdx = Math.max(0, Math.min(399, Math.floor(silhouetteX)));
                  
                  const logoSegments = segments[sampleIdx] || [];
                  
                  if (safeDistortion > 0) {
                    // Apply distortion: interpolate between full bar [0, 1] and logo segments
                    finalSegments = logoSegments.map(seg => ({
                      start: seg.start * safeDistortion,
                      end: 1 - (1 - seg.end) * safeDistortion
                    }));
                  } else {
                    finalSegments = [{ start: 0, end: 1 }];
                  }
                } else {
                  // Fallback wave if no silhouette
                  const wave = (Math.sin(xPos * 12) * 0.45 + 0.5);
                  finalSegments = [{ start: (1 - wave) * safeDistortion, end: 1 }];
                }

                // Ensure Safe Zone is always present for scannability
                const safeStart = 1 - safeSafeZone;
                const safeEnd = 1;
                finalSegments.push({ start: safeStart, end: safeEnd });

                // Merge overlapping segments
                finalSegments.sort((a, b) => a.start - b.start);
                const merged: { start: number; end: number }[] = [];
                if (finalSegments.length > 0) {
                  let current = { ...finalSegments[0] };
                  for (let i = 1; i < finalSegments.length; i++) {
                    if (finalSegments[i].start <= current.end) {
                      current.end = Math.max(current.end, finalSegments[i].end);
                    } else {
                      merged.push(current);
                      current = { ...finalSegments[i] };
                    }
                  }
                  merged.push(current);
                }

                return merged.map((seg, segIdx) => (
                  <rect
                    key={`${idx}-${segIdx}-${seg.start}-${seg.end}-${safeDistortion}-${safeSafeZone}-${data.text}`}
                    x={bar.x + padding}
                    y={seg.start * barcodeHeight}
                    width={bar.width}
                    height={Math.max(0.5, (seg.end - seg.start) * barcodeHeight)}
                    fill={color}
                    shapeRendering="crispEdges"
                  />
                ));
              })}
            </g>

            {/* Baseline */}
            <line 
              x1={padding} 
              y1={barcodeHeight} 
              x2={viewBoxWidth - padding} 
              y2={barcodeHeight} 
              stroke={color} 
              strokeWidth="0.5"
              opacity="0.3"
            />

            {/* Barcode Text */}
            <text
              x={viewBoxWidth / 2}
              y={barcodeHeight + 15}
              textAnchor="middle"
              fill={color}
              className="font-mono text-[7px] font-bold tracking-[0.3em]"
            >
              {data.text}
            </text>

            {/* Safe Zone Indicator */}
            {showSafeZone && (
              <line
                x1="0"
                y1={barcodeHeight * (1 - safeSafeZone)}
                x2={viewBoxWidth}
                y2={barcodeHeight * (1 - safeSafeZone)}
                stroke="red"
                strokeWidth="0.22"
                strokeDasharray="1 1"
                opacity="0.5"
              />
            )}
          </svg>
        </div>
      ) : (
        <div className="text-zinc-400 font-medium flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="w-24 h-24 rounded-full bg-zinc-50 border-2 border-dashed border-zinc-200 flex items-center justify-center">
            <span className="text-4xl">{error ? '!' : '?'}</span>
          </div>
          <p>{error || 'Enter data to generate barcode'}</p>
        </div>
      )}
    </div>
  );
};
