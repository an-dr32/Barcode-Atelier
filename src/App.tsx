import React, { useState, useEffect, useCallback } from 'react';
import { BarcodeCanvas } from './components/BarcodeCanvas';
import { generateBarcodeData, BarcodeData, BarcodeType, calculateScannability } from './lib/barcode-utils';
import { processImage, ImageProcessingResult } from './lib/image-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Barcode, 
  Image as ImageIcon, 
  Settings2, 
  Download, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Maximize2,
  Palette,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { toPng, toSvg } from 'html-to-image';

import { PRESET_SHAPES } from './lib/presets';

const EditablePercentage = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  label: string 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(Math.round(value * 100).toString());

  useEffect(() => {
    setTempValue(Math.round(value * 100).toString());
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseInt(tempValue);
    if (!isNaN(num)) {
      onChange(Math.max(0, Math.min(100, num)) / 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(Math.round(value * 100).toString());
    }
  };

  return (
    <div className="flex justify-between items-center">
      <Label className="text-xs font-semibold">{label}</Label>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            className="h-6 w-12 text-[10px] font-mono p-1 text-right"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <span className="text-[10px] font-mono text-zinc-400">%</span>
        </div>
      ) : (
        <span 
          className="text-[10px] font-mono text-zinc-400 cursor-pointer hover:text-zinc-900 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {Math.round((value || 0) * 100)}%
        </span>
      )}
    </div>
  );
};

const EditableNumber = ({ 
  value, 
  onChange, 
  label,
  min = 0,
  max = 1000,
  suffix = ""
}: { 
  value: number; 
  onChange: (val: number) => void; 
  label: string;
  min?: number;
  max?: number;
  suffix?: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseInt(tempValue);
    if (!isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value.toString());
    }
  };

  return (
    <div className="flex justify-between items-center">
      <Label className="text-xs font-semibold">{label}</Label>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            className="h-6 w-16 text-[10px] font-mono p-1 text-right"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {suffix && <span className="text-[10px] font-mono text-zinc-400">{suffix}</span>}
        </div>
      ) : (
        <span 
          className="text-[10px] font-mono text-zinc-400 cursor-pointer hover:text-zinc-900 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {value}{suffix}
        </span>
      )}
    </div>
  );
};

export default function App() {
  // State
  const [inputText, setInputText] = useState('123456789012');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
  const [barcodeData, setBarcodeData] = useState<BarcodeData | null>(null);
  const [silhouette, setSilhouette] = useState<string | null>(null);
  const [distortion, setDistortion] = useState(0.5);
  const [safeZone, setSafeZone] = useState(0.2);
  const [barcodeHeight, setBarcodeHeight] = useState(150);
  const [isDragging, setIsDragging] = useState(false);

  // Sanitize state to prevent NaN
  useEffect(() => {
    if (isNaN(distortion)) setDistortion(0.5);
    if (isNaN(safeZone)) setSafeZone(0.2);
  }, [distortion, safeZone]);

  const handleDistortionChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setDistortion(val);
    }
  }, []);

  const handleSafeZoneChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setSafeZone(val);
    }
  }, []);

  const handleHeightChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setBarcodeHeight(val);
    }
  }, []);
  const [color, setColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate Barcode
  useEffect(() => {
    const data = generateBarcodeData(inputText, barcodeType);
    setBarcodeData(data);

    if (!data && inputText) {
      if (barcodeType === 'EAN13') {
        setError('EAN-13 requires exactly 12 or 13 digits.');
      } else if (barcodeType === 'UPC') {
        setError('UPC requires exactly 11 or 12 digits.');
      } else {
        setError('Invalid input for selected barcode type.');
      }
    } else {
      setError(null);
    }
  }, [inputText, barcodeType]);

  // Handle Image Upload
  const processUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const result = await processImage(file);
      setSilhouette(result.silhouette);
      setWarnings(result.warnings);
      toast.success('Silhouette extracted successfully');
    } catch (err) {
      toast.error('Failed to process image');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processUpload(file);
    } else {
      toast.error('Please drop an image file');
    }
  };

  const handlePresetSelect = (path: string) => {
    setSilhouette(path);
    setWarnings([]);
    toast.success('Preset shape applied');
  };

  const setWaveMode = () => {
    setSilhouette(null);
    setDistortion(0.5);
    toast.success('Wave mode activated');
  };

  const setSquareMode = () => {
    setSilhouette(null);
    setDistortion(0);
    toast.success('Standard square mode activated');
  };

  const scannabilityScore = calculateScannability(barcodeData?.binary || '', distortion, safeZone);

  const getScoreColor = (score: number) => {
    if (score > 80) return 'text-emerald-500';
    if (score > 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreIcon = (score: number) => {
    if (score > 80) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (score > 50) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-rose-500" />;
  };

  const exportAsPng = async () => {
    const element = document.getElementById('barcode-svg');
    if (!element) return;
    try {
      const dataUrl = await toPng(element, { backgroundColor: bgColor });
      const link = document.createElement('a');
      link.download = `barcode-atelier-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      confetti();
      toast.success('Exported as PNG');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const exportAsSvg = async () => {
    const element = document.getElementById('barcode-svg');
    if (!element) return;
    try {
      const dataUrl = await toSvg(element);
      const link = document.createElement('a');
      link.download = `barcode-atelier-${Date.now()}.svg`;
      link.href = dataUrl;
      link.click();
      confetti();
      toast.success('Exported as SVG');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-200">
        <Toaster position="top-center" />
        
        {/* Header */}
        <header className="h-16 border-bottom border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Barcode className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Barcode Atelier</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Artistic Generator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportAsSvg} className="gap-2">
              <Download className="w-4 h-4" />
              SVG
            </Button>
            <Button size="sm" onClick={exportAsPng} className="gap-2 bg-zinc-900 hover:bg-zinc-800">
              <Download className="w-4 h-4" />
              PNG
            </Button>
          </div>
        </header>

        <main className="flex h-[calc(100vh-64px)] overflow-hidden">
          {/* Left Panel: Inputs */}
          <aside className="w-80 border-right border-zinc-200 bg-white flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Zap className="w-4 h-4" />
                    <h2 className="text-xs font-bold uppercase tracking-wider">Generator</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="barcode-type">Standard</Label>
                      <Tabs value={barcodeType} onValueChange={(v) => setBarcodeType(v as BarcodeType)} className="w-full">
                        <TabsList className="grid grid-cols-3 w-full">
                          <TabsTrigger value="CODE128">C128</TabsTrigger>
                          <TabsTrigger value="EAN13">EAN13</TabsTrigger>
                          <TabsTrigger value="UPC">UPC</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barcode-text">Data Content</Label>
                      <Input 
                        id="barcode-text" 
                        value={inputText} 
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Enter text or numbers..."
                        className="bg-zinc-50 border-zinc-200 focus:ring-zinc-900"
                      />
                      <p className="text-[10px] text-zinc-400">
                        {barcodeType === 'EAN13' ? 'Requires 12 or 13 digits' : 'Alphanumeric supported'}
                      </p>
                    </div>
                  </div>
                </section>

                <Separator className="bg-zinc-100" />

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <ImageIcon className="w-4 h-4" />
                    <h2 className="text-xs font-bold uppercase tracking-wider">Silhouette</h2>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Preset Shapes */}
                    <div className="grid grid-cols-5 gap-2">
                      <Tooltip>
                        <TooltipTrigger
                          onClick={setSquareMode}
                          className={cn(
                            "aspect-square w-full rounded-lg border flex items-center justify-center transition-all duration-300 hover:border-zinc-900",
                            (!silhouette && distortion === 0)
                              ? "bg-zinc-900 border-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2" 
                              : "bg-zinc-50 border-zinc-200 text-zinc-400"
                          )}
                        >
                          <div className="w-6 h-6 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-current rounded-sm" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Standard Square</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          onClick={setWaveMode}
                          className={cn(
                            "aspect-square w-full rounded-lg border flex items-center justify-center transition-all duration-300 hover:border-zinc-900",
                            (!silhouette && distortion > 0)
                              ? "bg-zinc-900 border-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2" 
                              : "bg-zinc-50 border-zinc-200 text-zinc-400"
                          )}
                        >
                          <div className="w-6 h-6 flex items-center justify-center">
                            <Zap className="w-4 h-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Default Wave</p>
                        </TooltipContent>
                      </Tooltip>

                      {PRESET_SHAPES.map((shape) => (
                        <div key={shape.name}>
                          <Tooltip>
                            <TooltipTrigger
                              onClick={() => handlePresetSelect(shape.path)}
                              className={cn(
                                "aspect-square w-full rounded-lg border flex items-center justify-center transition-all duration-300 hover:border-zinc-900",
                                silhouette === shape.path 
                                  ? "bg-zinc-900 border-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2" 
                                  : "bg-zinc-50 border-zinc-200 text-zinc-400"
                              )}
                            >
                              <div className="w-6 h-6 overflow-hidden flex items-center justify-center">
                                <svg viewBox="0 0 400 400" className="w-full h-full fill-current">
                                  <path d={shape.path} />
                                </svg>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{shape.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>

                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group",
                        isDragging 
                          ? "border-zinc-900 bg-zinc-100 scale-[1.02]" 
                          : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-400"
                      )}
                      onClick={() => document.getElementById('image-upload')?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input 
                        type="file" 
                        id="image-upload" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                      />
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        {isProcessing ? (
                          <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-zinc-600">
                        {isProcessing ? 'Processing...' : 'Upload Logo/Shape'}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1">SVG, PNG or JPG</p>
                    </div>

                    {silhouette && (
                      <Button variant="outline" size="sm" className="w-full text-zinc-500" onClick={() => setSilhouette(null)}>
                        Clear Silhouette
                      </Button>
                    )}

                    {warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Compatibility Warnings</span>
                        </div>
                        <ul className="space-y-1">
                          {warnings.map((w, i) => (
                            <li key={i} className="text-[11px] text-amber-600 leading-tight">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </aside>

          {/* Center: Canvas */}
          <section className="flex-1 bg-[#f0f0f0] flex flex-col items-center justify-center p-12 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={`${inputText}-${barcodeType}-${silhouette}`}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-2xl z-10"
              >
                <BarcodeCanvas 
                  data={barcodeData}
                  silhouette={silhouette}
                  distortion={distortion}
                  safeZone={safeZone}
                  barcodeHeight={barcodeHeight}
                  color={color}
                  backgroundColor={bgColor}
                  showSafeZone={showSafeZone}
                  error={error}
                />
              </motion.div>
            </AnimatePresence>

            {/* Floating Status */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur-sm border border-zinc-200 px-6 py-3 rounded-full shadow-xl z-20">
              <div className="flex items-center gap-3 border-right border-zinc-100 pr-4">
                {getScoreIcon(scannabilityScore)}
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-400 leading-none mb-1">Scanability</p>
                  <p className={`text-sm font-bold ${getScoreColor(scannabilityScore)}`}>{scannabilityScore}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${scannabilityScore > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <p className="text-xs font-medium text-zinc-600">
                  {scannabilityScore > 80 ? 'Safe to scan' : scannabilityScore > 50 ? 'Risky' : 'Not scannable'}
                </p>
              </div>
            </div>
          </section>

          {/* Right Panel: Controls */}
          <aside className="w-80 border-left border-zinc-200 bg-white flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                <section className="space-y-6">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Settings2 className="w-4 h-4" />
                    <h2 className="text-xs font-bold uppercase tracking-wider">Transformation</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <EditablePercentage 
                        label="Distortion Intensity" 
                        value={distortion} 
                        onChange={(val) => setDistortion(val)} 
                      />
                      <Slider 
                        value={[distortion]} 
                        onValueChange={handleDistortionChange} 
                        max={1} 
                        step={0.01} 
                        className="py-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <EditableNumber 
                        label="Vertical Scale" 
                        value={barcodeHeight} 
                        onChange={(val) => setBarcodeHeight(val)} 
                        min={50}
                        max={500}
                        suffix="px"
                      />
                      <Slider 
                        value={[barcodeHeight]} 
                        onValueChange={handleHeightChange} 
                        min={50}
                        max={500} 
                        step={1} 
                        className="py-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <EditablePercentage 
                        label="Scan-Safe Zone" 
                        value={safeZone} 
                        onChange={(val) => setSafeZone(val)} 
                      />
                      <Slider 
                        value={[safeZone]} 
                        onValueChange={handleSafeZoneChange} 
                        min={0.1}
                        max={0.5} 
                        step={0.01} 
                        className="py-4"
                      />
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-safe-zone" className="text-[10px] text-zinc-500">Show Guide Overlay</Label>
                        <Switch id="show-safe-zone" checked={showSafeZone} onCheckedChange={setShowSafeZone} />
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-zinc-100" />

                <section className="space-y-6">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Palette className="w-4 h-4" />
                    <h2 className="text-xs font-bold uppercase tracking-wider">Appearance</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase text-zinc-400">Ink Color</Label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={color} 
                          onChange={(e) => setColor(e.target.value)}
                          className="w-8 h-8 rounded-md border-0 p-0 cursor-pointer overflow-hidden"
                        />
                        <span className="text-[10px] font-mono uppercase">{color}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase text-zinc-400">Background</Label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={bgColor} 
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-8 h-8 rounded-md border-0 p-0 cursor-pointer overflow-hidden"
                        />
                        <span className="text-[10px] font-mono uppercase">{bgColor}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-zinc-100" />

                <section className="bg-zinc-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Info className="w-4 h-4" />
                    <h2 className="text-[10px] font-bold uppercase tracking-wider">Guidelines</h2>
                  </div>
                  <ul className="space-y-2">
                    <li className="text-[11px] text-zinc-500 leading-relaxed">
                      • Keep the <span className="text-zinc-900 font-semibold">Safe Zone</span> above 20% for reliable scanning.
                    </li>
                    <li className="text-[11px] text-zinc-500 leading-relaxed">
                      • High contrast between ink and background is essential.
                    </li>
                    <li className="text-[11px] text-zinc-500 leading-relaxed">
                      • Avoid excessive distortion on complex silhouettes.
                    </li>
                  </ul>
                </section>
              </div>
            </ScrollArea>
          </aside>
        </main>
      </div>
    </TooltipProvider>
  );
}
