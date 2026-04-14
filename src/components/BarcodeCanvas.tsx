import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarcodeData } from '../lib/barcode-utils';

interface BarcodeCanvasProps {
  data: BarcodeData | null;
  silhouette: string | null;
  distortion: number;
  safeZone: number;
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
  color,
  backgroundColor,
  showSafeZone,
  error
}) => {
  const [silhouetteData, setSilhouetteData] = useState<{
    topEdges: number[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  const bars = useMemo(() => {
    if (!data) return [];
    return data.bars;
  }, [data]);

  // Sample the silhouette path to find top edges and bounding box
  useEffect(() => {
    if (!silhouette) {
      setSilhouetteData(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = 400;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    try {
      const path = new Path2D(silhouette);
      
      // Auto-scale path to fit 400x400
      // We'll draw it once to find its bounds, then scale and draw again
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
          const scale = Math.min(width / sWidth, height / sHeight) * 0.9;
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
    } catch (e) {
      console.error('Invalid silhouette path:', e);
      setSilhouetteData(null);
      return;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const dataArr = imageData.data;
    const topEdges = new Array(width).fill(1);
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasPixels = false;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (dataArr[idx + 3] > 50) {
          const normalizedY = y / height;
          if (normalizedY < topEdges[x]) {
            topEdges[x] = normalizedY;
          }
          
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) {
      setSilhouetteData(null);
      return;
    }

    setSilhouetteData({
      topEdges,
      minX,
      maxX,
      minY,
      maxY
    });
  }, [silhouette]);

  const viewBoxWidth = data ? Math.max(120, data.totalWidth + 40) : 120;
  const viewBoxHeight = 130;
  const barcodeHeight = 100;
  const padding = (viewBoxWidth - (data?.totalWidth || 0)) / 2;

  const safeDistortion = typeof distortion === 'number' && !isNaN(distortion) ? distortion : 0.5;
  const safeSafeZone = typeof safeZone === 'number' && !isNaN(safeZone) ? safeZone : 0.2;

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
                const safeHeightPercent = Math.max(0.05, Math.min(0.95, safeSafeZone));
                const safeTopY = barcodeHeight * (1 - safeHeightPercent);
                
                const totalWidth = data.totalWidth || 1;
                const xPos = (bar.x + bar.width / 2) / totalWidth; // Use center of bar for sampling
                
                let shapeFactor = 1; // Default to full height

                if (silhouetteData) {
                  const { topEdges, minX, maxX } = silhouetteData;
                  const range = maxX - minX;
                  
                  // Map xPos (0-1) to the silhouette's horizontal range [minX, maxX]
                  const silhouetteX = range > 0 ? minX + xPos * range : minX;
                  const sampleIdx = Math.max(0, Math.min(399, Math.floor(silhouetteX)));
                  
                  const edgeValue = topEdges[sampleIdx];
                  if (typeof edgeValue === 'number' && !isNaN(edgeValue)) {
                    if (edgeValue < 1) {
                      shapeFactor = 1 - edgeValue;
                    } else {
                      shapeFactor = 0.05; 
                    }
                  }
                } else {
                  shapeFactor = (Math.sin(xPos * 6) * 0.4 + 0.5);
                }
                
                // More aggressive distortion: use the full safeTopY space
                const actualTopY = safeDistortion === 0 ? 0 : (safeTopY * safeDistortion * (1 - shapeFactor));
                const clampedTopY = isNaN(actualTopY) ? 0 : Math.max(0, Math.min(safeTopY - 2, actualTopY));

                return (
                  <motion.rect
                    key={idx}
                    x={bar.x + padding}
                    y={clampedTopY}
                    width={bar.width}
                    height={Math.max(1, barcodeHeight - clampedTopY)}
                    fill={color}
                    initial={{ height: 0, y: barcodeHeight }}
                    animate={{ 
                      height: Math.max(1, barcodeHeight - clampedTopY),
                      y: clampedTopY
                    }}
                    transition={{ 
                      duration: 0.4, 
                      delay: idx * 0.001,
                      ease: "easeOut"
                    }}
                  />
                );
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
                strokeWidth="0.2"
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
