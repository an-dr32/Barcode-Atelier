import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Zap,
  Waves,
  ChevronDown,
  Plus,
  Trash2,
  Save,
  History,
  RotateCcw,
  Undo2,
  Redo2,
  Search
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

interface SavedBarcode {
  id: string;
  name: string;
  text: string;
  type: BarcodeType;
  silhouette: string | null;
  distortion: number;
  safeZone: number;
  horizontalOffset: number;
  barWidthScale: number;
  logoSmoothing: number;
  logoDetail: number;
  barcodeHeight: number;
  color: string;
  bgColor: string;
  timestamp: number;
}

interface CustomSilhouette {
  id: string;
  path: string;
  previewUrl: string;
}

export default function App() {
  // State
  const [inputText, setInputText] = useState('123456789012');
  const [barcodeName, setBarcodeName] = useState('My Barcode');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
  const [barcodeData, setBarcodeData] = useState<BarcodeData | null>(null);
  const [silhouette, setSilhouette] = useState<string | null>(null);
  const [distortion, setDistortion] = useState(0.5);
  const [safeZone, setSafeZone] = useState(0.2);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const [barWidthScale, setBarWidthScale] = useState(1);
  const [logoSmoothing, setLogoSmoothing] = useState(0.2);
  const [logoDetail, setLogoDetail] = useState(0.1);
  const [barcodeHeight, setBarcodeHeight] = useState(150);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customSilhouettes, setCustomSilhouettes] = useState<CustomSilhouette[]>([]);
  const [savedBarcodes, setSavedBarcodes] = useState<SavedBarcode[]>([]);

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

  const handleHorizontalOffsetChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setHorizontalOffset(val);
    }
  }, []);

  const handleBarWidthScaleChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setBarWidthScale(val);
    }
  }, []);

  const handleLogoSmoothingChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setLogoSmoothing(val);
    }
  }, []);

  const handleLogoDetailChange = useCallback((v: number[]) => {
    if (v && v.length > 0) {
      const val = v[0];
      if (!isNaN(val)) setLogoDetail(val);
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

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Undo/Redo History
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalChange = useRef(false);

  const currentConfig = useMemo(() => ({
    inputText,
    barcodeType,
    silhouette,
    distortion,
    safeZone,
    horizontalOffset,
    barWidthScale,
    logoSmoothing,
    logoDetail,
    barcodeHeight,
    color,
    bgColor
  }), [
    inputText, barcodeType, silhouette, distortion, safeZone,
    horizontalOffset, barWidthScale, logoSmoothing, logoDetail,
    barcodeHeight, color, bgColor
  ]);

  const applyConfig = useCallback((config: any) => {
    isInternalChange.current = true;
    setInputText(config.inputText);
    setBarcodeType(config.barcodeType);
    setSilhouette(config.silhouette);
    setDistortion(config.distortion);
    setSafeZone(config.safeZone);
    setHorizontalOffset(config.horizontalOffset);
    setBarWidthScale(config.barWidthScale);
    setLogoSmoothing(config.logoSmoothing);
    setLogoDetail(config.logoDetail);
    setBarcodeHeight(config.barcodeHeight);
    setColor(config.color);
    setBgColor(config.bgColor);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevConfig = history[historyIndex - 1];
      applyConfig(prevConfig);
      setHistoryIndex(historyIndex - 1);
      toast.info('Undo', { duration: 1000 });
    }
  }, [history, historyIndex, applyConfig]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextConfig = history[historyIndex + 1];
      applyConfig(nextConfig);
      setHistoryIndex(historyIndex + 1);
      toast.info('Redo', { duration: 1000 });
    }
  }, [history, historyIndex, applyConfig]);

  // Record history
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInternalChange.current) {
        isInternalChange.current = false;
        return;
      }

      const lastConfig = history[historyIndex];
      if (JSON.stringify(currentConfig) !== JSON.stringify(lastConfig)) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(currentConfig);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 800); // Debounce history recording

    return () => clearTimeout(timer);
  }, [currentConfig, history, historyIndex]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const resetTransformations = () => {
    setDistortion(0.5);
    setSafeZone(0.2);
    setHorizontalOffset(0);
    setBarWidthScale(1);
    setLogoSmoothing(0.2);
    setLogoDetail(0.1);
    setBarcodeHeight(150);
    toast.success('Transformations reset to default');
  };

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
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const pUrl = reader.result as string;
        const newCustom: CustomSilhouette = {
          id: Math.random().toString(36).substr(2, 9),
          path: result.silhouette,
          previewUrl: pUrl
        };
        setCustomSilhouettes(prev => [newCustom, ...prev]);
        setSilhouette(result.silhouette);
        setPreviewUrl(pUrl);
      };
      reader.readAsDataURL(file);

      setWarnings(result.warnings);
      setDistortion(1.0); // Automatically set to 100% on upload
      toast.success('Silhouette extracted successfully');
    } catch (err) {
      toast.error('Failed to process image');
      console.error(err);
    } finally {
      setIsProcessing(false);
      // Reset file input to allow re-uploading the same file
      const input = document.getElementById('image-upload') as HTMLInputElement;
      if (input) input.value = '';
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

  const handleCustomSelect = (cs: CustomSilhouette) => {
    setSilhouette(cs.path);
    setPreviewUrl(cs.previewUrl);
    toast.success('Custom logo applied');
  };

  const deleteCustomSilhouette = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCustomSilhouettes(prev => {
      const filtered = prev.filter(cs => cs.id !== id);
      // If we deleted the active silhouette, clear it
      const deleted = prev.find(cs => cs.id === id);
      if (deleted && silhouette === deleted.path) {
        setSilhouette(null);
        setPreviewUrl(null);
      }
      return filtered;
    });
    toast.success('Custom logo removed');
  };

  const setWaveMode = () => {
    setSilhouette(null);
    setDistortion(0.5);
    toast.success('Wave mode activated');
  };

  const setSquareMode = () => {
    setSilhouette(null);
    setPreviewUrl(null);
    setDistortion(0);
    toast.success('Standard square mode activated');
  };

  const scannabilityScore = calculateScannability(barcodeData?.binary || '', distortion, safeZone);

  const saveCurrentBarcode = () => {
    const newSaved: SavedBarcode = {
      id: Math.random().toString(36).substr(2, 9),
      name: barcodeName || 'Untitled',
      text: inputText,
      type: barcodeType,
      silhouette,
      distortion,
      safeZone,
      horizontalOffset,
      barWidthScale,
      logoSmoothing,
      logoDetail,
      barcodeHeight,
      color,
      bgColor,
      timestamp: Date.now()
    };
    setSavedBarcodes(prev => [newSaved, ...prev]);
    toast.success(`"${newSaved.name}" saved to drawer`);
    setBarcodeName('My Barcode');
  };

  const loadBarcode = (bc: SavedBarcode) => {
    setBarcodeName(bc.name);
    setInputText(bc.text);
    setBarcodeType(bc.type);
    setSilhouette(bc.silhouette);
    setDistortion(bc.distortion);
    setSafeZone(bc.safeZone);
    setHorizontalOffset(bc.horizontalOffset || 0);
    setBarWidthScale(bc.barWidthScale || 1);
    setLogoSmoothing(bc.logoSmoothing ?? 0.2);
    setLogoDetail(bc.logoDetail ?? 0.1);
    setBarcodeHeight(bc.barcodeHeight);
    setColor(bc.color);
    setBgColor(bc.bgColor);
    toast.success(`"${bc.name}" configuration loaded`);
  };

  const deleteSavedBarcode = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedBarcodes(prev => prev.filter(bc => bc.id !== id));
    toast.success('Removed from drawer');
  };

  // Grab-to-scroll logic
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDraggingScroll(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

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
          <a 
            href="https://andresdm-portfolio-site.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Barcode className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Barcode Atelier</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">by Andres De Moya</p>
            </div>
          </a>
          
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

        <main className="flex min-h-[calc(100vh-64px)]">
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
                          <span className="w-6 h-6 flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-current rounded-sm" />
                          </span>
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
                          <span className="w-6 h-6 flex items-center justify-center">
                            <Waves className="w-4 h-4" />
                          </span>
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
                              <span className="w-6 h-6 overflow-hidden flex items-center justify-center">
                                <svg viewBox="0 0 400 400" className="w-full h-full fill-current">
                                  <path d={shape.path} />
                                </svg>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{shape.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>

                    {/* Custom Logos Gallery */}
                    {customSilhouettes.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase text-zinc-400 font-bold tracking-tight">Your Logos</Label>
                          <span className="text-[10px] font-bold text-zinc-300">{customSilhouettes.length}</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {customSilhouettes.map((cs) => (
                            <div key={cs.id} className="relative group">
                              <Tooltip>
                                <TooltipTrigger
                                  onClick={() => handleCustomSelect(cs)}
                                  className={cn(
                                    "aspect-square w-full rounded-lg border flex items-center justify-center transition-all duration-300 hover:border-zinc-900 overflow-hidden p-1",
                                    silhouette === cs.path 
                                      ? "bg-zinc-900 border-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2" 
                                      : "bg-zinc-50 border-zinc-200 text-zinc-400"
                                  )}
                                >
                                  <img 
                                    src={cs.previewUrl} 
                                    alt="Custom" 
                                    className={cn("w-full h-full object-contain", silhouette === cs.path && "invert brightness-200")} 
                                    referrerPolicy="no-referrer"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Custom Logo</p>
                                </TooltipContent>
                              </Tooltip>
                              <button
                                onClick={(e) => deleteCustomSilhouette(e, cs.id)}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600 z-10"
                              >
                                <Trash2 className="w-2 h-2" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {previewUrl && silhouette && customSilhouettes.some(cs => cs.path === silhouette) && (
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase text-zinc-400 font-bold tracking-tight">Image Preview</Label>
                        <div className="relative aspect-square w-full bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center p-4 group">
                          <img 
                            src={previewUrl} 
                            alt="Uploaded preview" 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={() => {
                              const activeCs = customSilhouettes.find(cs => cs.path === silhouette);
                              if (activeCs) {
                                deleteCustomSilhouette({ stopPropagation: () => {} } as any, activeCs.id);
                              }
                            }}
                            className="absolute top-2 right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-rose-600"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

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
          <section className="flex-1 bg-[#f0f0f0] flex flex-col items-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <div className="flex-1 w-full flex items-center justify-center p-6 relative">
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
                    horizontalOffset={horizontalOffset}
                    barWidthScale={barWidthScale}
                    logoSmoothing={logoSmoothing}
                    logoDetail={logoDetail}
                    barcodeHeight={barcodeHeight}
                    color={color}
                    backgroundColor={bgColor}
                    showSafeZone={showSafeZone}
                    error={error}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Save Section */}
            <div className="z-20 w-full max-w-md mb-4 px-6">
              <Card className="bg-white border-zinc-200 shadow-sm rounded-xl overflow-hidden">
                <div className="px-3 py-1.5 space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="save-name" className="text-[10px] uppercase text-zinc-400 font-bold tracking-tight">Barcode Name</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="save-name"
                        value={barcodeName}
                        onChange={(e) => setBarcodeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveCurrentBarcode();
                          }
                        }}
                        placeholder="e.g., Summer Collection 2024"
                        className="h-8 text-xs bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-900"
                      />
                      <Button 
                        onClick={saveCurrentBarcode}
                        className="h-8 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg px-4 transition-all active:scale-95 font-bold text-xs gap-2"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Saved Barcodes Drawer */}
            <div className="w-full h-80 bg-white border-t border-zinc-200 z-20 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.04)] relative pb-6">
              <div className="px-6 py-2.5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest">Saved Barcodes</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-6 w-6 text-zinc-400 hover:text-zinc-900", isSearchOpen && "text-zinc-900 bg-zinc-100")}
                    onClick={() => {
                      setIsSearchOpen(!isSearchOpen);
                      if (isSearchOpen) setSearchQuery('');
                    }}
                  >
                    <Search className="w-3 h-3" />
                  </Button>
                  <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{savedBarcodes.length}</span>
                </div>
              </div>

              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 py-2 border-b border-zinc-50 overflow-hidden"
                  >
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                      <Input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, data, type, or date..."
                        className="h-7 text-[10px] pl-7 bg-zinc-50 border-zinc-100 focus-visible:ring-zinc-900"
                        autoFocus
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div 
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseUp}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className={cn(
                  "flex-1 w-full overflow-x-auto overflow-y-hidden select-none scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent",
                  isDraggingScroll ? "cursor-grabbing" : "cursor-grab"
                )}
              >
                <div className="flex gap-4 p-5 min-w-full">
                  {savedBarcodes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 py-4 min-w-[200px] mx-auto">
                      <Save className="w-6 h-6 mb-2 opacity-20" />
                      <p className="text-[10px] font-medium">No saved barcodes yet</p>
                    </div>
                  ) : (
                    savedBarcodes
                      .filter(bc => {
                        if (!searchQuery) return true;
                        const q = searchQuery.toLowerCase();
                        const dateStr = new Date(bc.timestamp).toLocaleString().toLowerCase();
                        return (
                          bc.name.toLowerCase().includes(q) ||
                          bc.text.toLowerCase().includes(q) ||
                          bc.type.toLowerCase().includes(q) ||
                          dateStr.includes(q)
                        );
                      })
                      .map((bc) => (
                        <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={bc.id}
                        onClick={() => !isDraggingScroll && loadBarcode(bc)}
                        className="flex-shrink-0 w-32 h-32 bg-zinc-50 border border-zinc-200 rounded-xl p-3 cursor-pointer hover:border-zinc-900 hover:bg-white transition-all group relative shadow-sm"
                      >
                        <div className="h-full flex flex-col justify-between pointer-events-none">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-zinc-900 truncate">{bc.name}</p>
                            <p className="text-[8px] text-zinc-500 truncate">{bc.text}</p>
                            <p className="text-[8px] text-zinc-400 uppercase font-bold tracking-tighter">{bc.type}</p>
                          </div>
                          <div className="flex-1 flex items-center justify-center overflow-hidden">
                            <BarcodeCanvas 
                              data={generateBarcodeData(bc.text, bc.type)}
                              silhouette={bc.silhouette}
                              distortion={bc.distortion}
                              safeZone={bc.safeZone}
                              horizontalOffset={bc.horizontalOffset}
                              barWidthScale={bc.barWidthScale}
                              logoSmoothing={bc.logoSmoothing}
                              logoDetail={bc.logoDetail}
                              barcodeHeight={bc.barcodeHeight}
                              color={bc.color}
                              backgroundColor={bc.bgColor}
                              showSafeZone={false}
                              isMini={true}
                            />
                          </div>
                          <div className="text-[8px] text-zinc-400 text-right">
                            {new Date(bc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedBarcode(e, bc.id);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-rose-600 pointer-events-auto"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right Panel: Controls */}
          <aside className="w-80 border-left border-zinc-200 bg-white flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Settings2 className="w-4 h-4" />
                      <h2 className="text-xs font-bold uppercase tracking-wider">Transformation</h2>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-zinc-400 hover:text-zinc-900"
                      onClick={resetTransformations}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
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
                        label="Horizontal Offset" 
                        value={Math.round(horizontalOffset * 100)} 
                        onChange={(val) => setHorizontalOffset(val / 100)} 
                        min={-100}
                        max={100}
                        suffix="%"
                      />
                      <Slider 
                        value={[horizontalOffset]} 
                        onValueChange={handleHorizontalOffsetChange} 
                        min={-1}
                        max={1} 
                        step={0.01} 
                        className="py-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <EditablePercentage 
                        label="Line Thickness" 
                        value={barWidthScale} 
                        onChange={(val) => setBarWidthScale(val)} 
                      />
                      <Slider 
                        value={[barWidthScale]} 
                        onValueChange={handleBarWidthScaleChange} 
                        min={0.1}
                        max={2} 
                        step={0.01} 
                        className="py-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <EditablePercentage 
                        label="Logo Smoothing" 
                        value={logoSmoothing} 
                        onChange={(val) => setLogoSmoothing(val)} 
                      />
                      <Slider 
                        value={[logoSmoothing]} 
                        onValueChange={handleLogoSmoothingChange} 
                        min={0}
                        max={1} 
                        step={0.01} 
                        className="py-4"
                      />
                    </div>

                    <div className="space-y-3">
                      <EditablePercentage 
                        label="Logo Detail Filter" 
                        value={logoDetail} 
                        onChange={(val) => setLogoDetail(val)} 
                      />
                      <Slider 
                        value={[logoDetail]} 
                        onValueChange={handleLogoDetailChange} 
                        min={0}
                        max={0.5} 
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
                        min={0}
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
                      • Keep the <span className="text-zinc-900 font-semibold">Safe Zone</span> above 10% for reliable scanning.
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

        <footer className="border-t border-zinc-200 bg-white py-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-zinc-900" />
                <span className="text-xs font-bold tracking-tight">Barcode Atelier</span>
              </div>
              <p className="text-[10px] text-zinc-400 max-w-xs border-l border-zinc-100 pl-6 hidden md:block">
                Professional-grade artistic barcode generator.
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-[11px] text-zinc-500">
                Created by <a href="https://andresdm-portfolio-site.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-bold hover:underline">Andres De Moya</a>
              </div>
              <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest font-bold text-zinc-300">
                <span>© 2025</span>
                <span className="w-1 h-1 bg-zinc-200 rounded-full" />
                <span>v1.2.1</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
