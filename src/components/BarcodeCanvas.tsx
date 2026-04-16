import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarcodeData } from '../lib/barcode-utils';
import { cn } from '@/lib/utils';

interface BarcodeCanvasProps {
  data: BarcodeData | null;
  silhouette: string | null;
  distortion: number;
  safeZone: number;
  horizontalOffset: number;
  barWidthScale: number;
  logoSmoothing: number;
  logoDetail: number;
  barcodeHeight?: number;
  silhouetteGap: number;
  showNumbers: boolean;
  numbersGap: number;
  color: string;
  backgroundColor: string;
  showSafeZone: boolean;
  error?: string | null;
  isMini?: boolean;
}

export const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({
  data,
  silhouette,
  distortion,
  safeZone,
  horizontalOffset,
  barWidthScale,
  logoSmoothing,
  logoDetail,
  barcodeHeight = 150,
  silhouetteGap,
  showNumbers,
  numbersGap,
  color,
  backgroundColor,
  showSafeZone,
  error,
  isMini = false
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

  const safeDistortion = (typeof distortion === 'number' && !isNaN(distortion)) ? distortion : 0.5;
  const safeSafeZone = (typeof safeZone === 'number' && !isNaN(safeZone)) ? safeZone : 0.2;
  const safeBarcodeHeight = (typeof barcodeHeight === 'number' && !isNaN(barcodeHeight)) ? barcodeHeight : 150;
  const safeSilhouetteGap = (typeof silhouetteGap === 'number' && !isNaN(silhouetteGap)) ? silhouetteGap : 0;
  const safeNumbersGap = (typeof numbersGap === 'number' && !isNaN(numbersGap)) ? numbersGap : 15;

  const viewBoxWidth = data ? Math.max(120, data.totalWidth + 40) : 120;
  const viewBoxHeight = safeBarcodeHeight + (showNumbers ? safeNumbersGap + 30 : 0) + 10; 
  const padding = (viewBoxWidth - (data?.totalWidth || 0)) / 2;

  return (
    <div className={cn(
      "relative w-full mx-auto bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-zinc-200 flex items-center justify-center transition-all duration-500",
      isMini ? "p-2 shadow-none border-none rounded-none bg-transparent" : "p-6 sm:p-12"
    )} style={{ backgroundColor: isMini ? 'transparent' : backgroundColor, aspectRatio: isMini ? 'auto' : '1/1' }}>
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
                <rect x="0" y="0" width={viewBoxWidth} height={safeBarcodeHeight} />
              </clipPath>
            </defs>

            {/* Background for contrast and quiet zone */}
            <rect x="0" y="0" width={viewBoxWidth} height={viewBoxHeight} fill="white" />

            {/* Barcode Bars */}
            <g clipPath="url(#barcode-clip)">
              {bars.map((bar, idx) => {
                const totalWidth = data.totalWidth || 1;
                const scaledWidth = bar.width * barWidthScale;
                const xOffset = (bar.width - scaledWidth) / 2;
                
                // Area Sampling: Sample all columns covered by the bar
                const startXPos = ((bar.x) / totalWidth) - horizontalOffset;
                const endXPos = ((bar.x + bar.width) / totalWidth) - horizontalOffset;
                
                let finalSegments: { start: number; end: number }[] = [];

                if (silhouetteData) {
                  const { segments, minX, maxX } = silhouetteData;
                  const rangeX = maxX - minX;
                  
                  const startIdx = Math.max(0, Math.min(399, Math.floor(minX + startXPos * rangeX)));
                  const endIdx = Math.max(0, Math.min(399, Math.floor(minX + endXPos * rangeX)));
                  
                  // Collect segments from all columns in range
                  const rawSegments: { start: number; end: number }[] = [];
                  for (let i = startIdx; i <= endIdx; i++) {
                    rawSegments.push(...(segments[i] || []));
                  }
                  
                  let logoSegments: { start: number; end: number }[] = [];
                  
                  // Union segments
                  if (rawSegments.length > 0) {
                    rawSegments.sort((a, b) => a.start - b.start);
                    let current = { ...rawSegments[0] };
                    for (let i = 1; i < rawSegments.length; i++) {
                      if (rawSegments[i].start <= current.end) {
                        current.end = Math.max(current.end, rawSegments[i].end);
                      } else {
                        logoSegments.push(current);
                        current = { ...rawSegments[i] };
                      }
                    }
                    logoSegments.push(current);
                  }
                  
                  // Apply Smoothing (merge nearby segments)
                  const smoothingThreshold = logoSmoothing * 0.1; // Max 10% of height
                  if (smoothingThreshold > 0 && logoSegments.length > 1) {
                    const smoothed: { start: number; end: number }[] = [];
                    let current = { ...logoSegments[0] };
                    for (let i = 1; i < logoSegments.length; i++) {
                      if (logoSegments[i].start - current.end <= smoothingThreshold) {
                        current.end = Math.max(current.end, logoSegments[i].end);
                      } else {
                        smoothed.push(current);
                        current = { ...logoSegments[i] };
                      }
                    }
                    smoothed.push(current);
                    logoSegments = smoothed;
                  }
                  
                  // Apply Detail Filter (remove tiny segments)
                  const detailThreshold = logoDetail * 0.05; // Max 5% of height
                  if (detailThreshold > 0) {
                    logoSegments = logoSegments.filter(seg => (seg.end - seg.start) >= detailThreshold);
                  }
                  
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
                  const xPos = ((bar.x + bar.width / 2) / totalWidth) - horizontalOffset;
                  const wave = (Math.sin(xPos * 12) * 0.45 + 0.5);
                  finalSegments = [{ start: (1 - wave) * safeDistortion, end: 1 }];
                }

                // Ensure Safe Zone is always present for scannability
                if (safeSafeZone > 0) {
                  const safeStart = 1 - safeSafeZone;
                  const safeEnd = 1;
                  finalSegments.push({ start: safeStart, end: safeEnd });
                }

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

                return merged.map((seg, segIdx) => {
                  const yPos = seg.start * safeBarcodeHeight;
                  const h = Math.max(0.5, (seg.end - seg.start) * safeBarcodeHeight);
                  
                  // Apply silhouette gap: push down segments that are NOT safe zone
                  const isSafeZone = seg.start >= (1 - safeSafeZone - 0.001);
                  const adjustedY = (isSafeZone || !silhouetteData) ? yPos : Math.max(0, yPos - safeSilhouetteGap);
                  const adjustedH = h; // Keep height constant to avoid moving the bottom edge

                  return (
                    <rect
                      key={`${idx}-${segIdx}-${seg.start}-${seg.end}-${safeDistortion}-${safeSafeZone}-${data.text}-${horizontalOffset}-${barWidthScale}-${safeSilhouetteGap}`}
                      x={bar.x + padding + xOffset}
                      width={scaledWidth}
                      y={adjustedY}
                      height={adjustedH}
                      fill={color}
                      shapeRendering="crispEdges"
                    />
                  );
                });
              })}
            </g>

            {/* Baseline */}
            {safeSafeZone > 0 && (
              <line 
                x1={padding} 
                y1={safeBarcodeHeight} 
                x2={viewBoxWidth - padding} 
                y2={safeBarcodeHeight} 
                stroke={color} 
                strokeWidth="0.5"
                opacity="0.3"
              />
            )}

            {/* Barcode Text */}
            {showNumbers && (
              <text
                x={viewBoxWidth / 2}
                y={safeBarcodeHeight + safeNumbersGap + 15}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                className={cn(
                  "font-mono text-[12px] font-bold tracking-[0.2em] barcode-numbers",
                  isMini && "opacity-0" // Hide in mini mode but keep in DOM for export
                )}
              >
                {data.text}
              </text>
            )}

            {/* Safe Zone Indicator */}
            {showSafeZone && (
              <>
                <line
                  x1="0"
                  y1={safeBarcodeHeight * (1 - safeSafeZone)}
                  x2={viewBoxWidth}
                  y2={safeBarcodeHeight * (1 - safeSafeZone)}
                  stroke="red"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                  opacity="0.8"
                />
                {silhouetteData && (
                  <>
                    <line
                      x1={padding + (silhouetteData.minX / 400) * (data.totalWidth)}
                      y1="0"
                      x2={padding + (silhouetteData.minX / 400) * (data.totalWidth)}
                      y2={safeBarcodeHeight}
                      stroke="red"
                      strokeWidth="0.5"
                      strokeDasharray="2 2"
                      opacity="0.8"
                    />
                    <line
                      x1={padding + (silhouetteData.maxX / 400) * (data.totalWidth)}
                      y1="0"
                      x2={padding + (silhouetteData.maxX / 400) * (data.totalWidth)}
                      y2={safeBarcodeHeight}
                      stroke="red"
                      strokeWidth="0.5"
                      strokeDasharray="2 2"
                      opacity="0.8"
                    />
                  </>
                )}
              </>
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
