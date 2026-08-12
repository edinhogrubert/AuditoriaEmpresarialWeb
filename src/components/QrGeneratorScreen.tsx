import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  QrCode,
  Copy,
  Check,
  Printer,
  Download,
  Sparkles,
  PlusCircle,
  Trash2,
  ListPlus,
  Layers,
  Grid,
  FileCode2,
  FileText,
  ScanLine,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX,
  Barcode as BarcodeIcon,
  Sliders,
  Maximize2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createQrChunks } from '../utils/qrChunker';
import { BarcodeRenderer } from './BarcodeRenderer';

interface QrGeneratorScreenProps {
  onBack: () => void;
  onCreateBatchWithItems?: (
    name: string,
    description: string,
    items: { barcode: string; description?: string }[]
  ) => void;
  initialText?: string;
}

interface QrItem {
  id: string;
  code: string;
  description?: string;
  category?: string;
}

export const QrGeneratorScreen: React.FC<QrGeneratorScreenProps> = ({
  onBack,
  onCreateBatchWithItems,
  initialText = '2231212 2231213 2231214',
}) => {
  // Generator type tab: 'BARCODE' vs 'QRCODE'
  const [generatorType, setGeneratorType] = useState<'BARCODE' | 'QRCODE'>('BARCODE');
  
  // Barcode format selector
  const [barcodeFormat, setBarcodeFormat] = useState<string>('CODE128');

  // Input raw text
  const [rawText, setRawText] = useState(initialText);

  // Copy states
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'CAROUSEL' | 'GRID' | 'SINGLE_COMBINED'>('CAROUSEL');
  const [combinedFormat, setCombinedFormat] = useState<'TRANSMISSION' | 'EXACT_PASTE' | 'ONE_PER_LINE'>('TRANSMISSION');
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);

  // Carousel Presenter States
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(2); // 1, 2, 3, 5, 10
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loopContinuous, setLoopContinuous] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);

  // Audio beep generator
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Pitch A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  };

  // Smart Parser for codes (handles spaces: "2231212 2231213 2231214", newlines, commas, tabs)
  const parseCodes = (text: string): QrItem[] => {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n');
    const items: QrItem[] = [];

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check if line contains CSV/tab/pipe headers/columns
      if (trimmed.includes('\t') || trimmed.includes('|') || (trimmed.includes(';') && !trimmed.match(/^[\d\s;,]+$/))) {
        const parts = trimmed.split(/[\t;|]/);
        const code = parts[0]?.trim();
        if (code) {
          items.push({
            id: `line-${lineIdx}-${code}`,
            code,
            description: parts[1]?.trim() || undefined,
            category: parts[2]?.trim() || undefined,
          });
        }
      } else {
        // Handle space/comma separated codes e.g. "2231212 2231213 2231214"
        const tokens = trimmed.split(/[\s,;]+/);
        tokens.forEach((token, tokenIdx) => {
          const code = token.trim();
          if (code) {
            items.push({
              id: `item-${lineIdx}-${tokenIdx}-${code}`,
              code,
            });
          }
        });
      }
    });

    return items;
  };

  const parsedItems = parseCodes(rawText);

  // Keep carouselIndex in bounds
  useEffect(() => {
    if (parsedItems.length === 0) {
      setCarouselIndex(0);
    } else if (carouselIndex >= parsedItems.length) {
      setCarouselIndex(0);
    }
  }, [parsedItems.length]);

  // Carousel Auto-Advance Effect
  useEffect(() => {
    if (!isPlaying || parsedItems.length === 0) {
      setProgressPercent(0);
      return;
    }

    const intervalMs = 100;
    const totalMs = autoDelaySeconds * 1000;
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += intervalMs;
      const pct = Math.min(100, (elapsedMs / totalMs) * 100);
      setProgressPercent(pct);

      if (elapsedMs >= totalMs) {
        elapsedMs = 0;
        setProgressPercent(0);

        setCarouselIndex((prev) => {
          const nextIdx = prev + 1;
          if (nextIdx < parsedItems.length) {
            playBeep();
            return nextIdx;
          } else {
            if (loopContinuous) {
              playBeep();
              return 0;
            } else {
              setIsPlaying(false);
              return prev;
            }
          }
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, autoDelaySeconds, parsedItems.length, loopContinuous, soundEnabled]);

  // Keyboard Navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'CAROUSEL' || parsedItems.length === 0) return;
      // Ignore if user is typing in textarea
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, parsedItems.length, carouselIndex]);

  const handleNextSlide = () => {
    if (parsedItems.length === 0) return;
    setIsPlaying(false);
    setProgressPercent(0);
    setCarouselIndex((prev) => (prev + 1) % parsedItems.length);
    playBeep();
  };

  const handlePrevSlide = () => {
    if (parsedItems.length === 0) return;
    setIsPlaying(false);
    setProgressPercent(0);
    setCarouselIndex((prev) => (prev - 1 + parsedItems.length) % parsedItems.length);
    playBeep();
  };

  // Generate combined payload text for all items together (for QR Code Single mode)
  const getCombinedPayload = (): string => {
    if (parsedItems.length === 0) return '';

    if (combinedFormat === 'TRANSMISSION') {
      const jsonItems = parsedItems.map((item) => ({
        barcode: item.code,
        description: item.description || undefined,
        category: item.category || undefined,
      }));
      return JSON.stringify(jsonItems);
    } else if (combinedFormat === 'EXACT_PASTE') {
      // Retém exatamente a formatação original colada pelo usuário (linhas e espaços)
      return rawText;
    } else {
      // ONE_PER_LINE
      return parsedItems.map((item) => item.code).join('\n');
    }
  };

  const combinedPayload = getCombinedPayload();

  // Handle chunks if combined text is large (> 300 chars)
  const isLargePayload = combinedPayload.length > 300;
  const qrChunks = isLargePayload ? createQrChunks(combinedPayload, 280) : [combinedPayload];
  const currentQrValue = qrChunks[activeChunkIndex] || combinedPayload;

  const handleCopyCode = (code: string, index?: number) => {
    navigator.clipboard.writeText(code);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopiedCurrent(true);
      setTimeout(() => setCopiedCurrent(false), 2000);
    }
  };

  const handleCopyAll = () => {
    const allText = parsedItems.map((i) => i.code).join('\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSvg = (code: string, filename: string, elementId: string) => {
    const svgElement = document.getElementById(elementId);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${filename}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleDownloadPng = (code: string, filename: string, elementId: string) => {
    const svgElement = document.getElementById(elementId) as unknown as SVGSVGElement;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${filename}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleCreateAudit = () => {
    if (!onCreateBatchWithItems) return;
    if (parsedItems.length === 0) return;

    const defaultName = `Auditoria - ${new Date().toLocaleDateString('pt-BR')}`;
    const formattedItems = parsedItems.map((item) => ({
      barcode: item.code,
      description: item.description || 'Item gerado',
    }));

    onCreateBatchWithItems(defaultName, 'Criado via Gerador de Códigos', formattedItems);
  };

  const currentCarouselItem = parsedItems[carouselIndex] || parsedItems[0];

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-4 select-none shadow-xl border-x border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              {generatorType === 'BARCODE' ? (
                <BarcodeIcon className="w-5 h-5 text-blue-500" />
              ) : (
                <QrCode className="w-5 h-5 text-blue-500" />
              )}
              <span>Gerador & Carrossel</span>
            </h1>
            <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest block">
              Códigos de Barras e QR Codes
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-4 flex-1 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
        
        {/* Type Toggle Tabs: Código de Barras vs QR Code */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl print:hidden">
          <button
            onClick={() => {
              setGeneratorType('BARCODE');
              if (viewMode === 'SINGLE_COMBINED') setViewMode('CAROUSEL');
            }}
            className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              generatorType === 'BARCODE'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarcodeIcon className="w-4 h-4" />
            <span>Código de Barras</span>
          </button>

          <button
            onClick={() => setGeneratorType('QRCODE')}
            className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              generatorType === 'QRCODE'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Code</span>
          </button>
        </div>

        {/* Input Box Section */}
        <div className="space-y-3 bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)] shadow-xs print:hidden">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
              <ListPlus className="w-4 h-4 text-blue-500" />
              <span>Cole os códigos (espaço, vírgula ou linha)</span>
            </label>

            {/* Quick Example Loader */}
            <button
              onClick={() => setRawText('2231212 2231213 2231214')}
              className="text-[10px] font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Exemplo (2231212...)</span>
            </button>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setActiveChunkIndex(0);
              setCarouselIndex(0);
            }}
            placeholder="Cole os códigos aqui. Exemplo:&#10;2231212 2231213 2231214"
            rows={3}
            className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
          />

          <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-dim)] font-medium pt-0.5 gap-2">
            <span>
              Total detectado: <strong className="text-[var(--text-primary)] font-bold">{parsedItems.length}</strong> {parsedItems.length === 1 ? 'código' : 'códigos'}
            </span>

            {/* Format Selector if Barcode Mode */}
            {generatorType === 'BARCODE' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold">Padrão:</span>
                <select
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value)}
                  className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] font-bold rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                >
                  <option value="CODE128">CODE128 (Universal)</option>
                  <option value="EAN13">EAN-13 (13 dígitos)</option>
                  <option value="EAN8">EAN-8 (8 dígitos)</option>
                  <option value="CODE39">CODE 39</option>
                  <option value="ITF14">ITF-14</option>
                </select>
              </div>
            )}

            {rawText && (
              <button
                onClick={() => setRawText('')}
                className="text-red-500 hover:text-red-400 text-[10px] font-bold flex items-center gap-1 ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Display Mode Selector Tabs */}
        {parsedItems.length > 0 && (
          <div className="space-y-2 print:hidden">
            <div className={`grid gap-2 p-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl ${generatorType === 'QRCODE' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              
              {/* Carousel Mode Tab */}
              <button
                onClick={() => setViewMode('CAROUSEL')}
                className={`py-2 px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'CAROUSEL'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Carrossel</span>
              </button>

              {/* Grid Mode Tab */}
              <button
                onClick={() => setViewMode('GRID')}
                className={`py-2 px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === 'GRID'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Grade ({parsedItems.length})</span>
              </button>

              {/* Single QR Master Mode Tab (QR Code mode only) */}
              {generatorType === 'QRCODE' && (
                <button
                  onClick={() => setViewMode('SINGLE_COMBINED')}
                  className={`py-2 px-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === 'SINGLE_COMBINED'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>QR Único</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Global Toolbar Actions */}
        {parsedItems.length > 0 && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="py-2.5 px-3 bg-[var(--bg-secondary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              {copiedAll ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAll ? 'Copiado!' : 'Copiar Códigos'}</span>
            </button>

            {onCreateBatchWithItems && (
              <button
                onClick={handleCreateAudit}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Criar Lote de Auditoria com {parsedItems.length} itens</span>
              </button>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW MODE 1: CAROUSEL PRESENTER MODE (SLIDE / AUTO ADVANCE)         */}
        {/* =================================================================== */}
        {parsedItems.length > 0 && viewMode === 'CAROUSEL' && currentCarouselItem && (
          <div className="space-y-4">
            
            {/* Carousel Presentation Card */}
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl relative overflow-hidden">
              
              {/* Animated Progress Line for Auto Advance */}
              {isPlaying && (
                <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-blue-500 transition-all ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Status Header Badge */}
              <div className="flex items-center justify-between w-full pt-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Item {carouselIndex + 1} de {parsedItems.length}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      soundEnabled
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                    title={soundEnabled ? 'Som de troca ativado' : 'Som desativado'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  <select
                    value={carouselIndex}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setCarouselIndex(Number(e.target.value));
                    }}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px] font-bold outline-none"
                  >
                    {parsedItems.map((item, idx) => (
                      <option key={item.id} value={idx}>
                        {idx + 1}. {item.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Large Display Graphic */}
              <div className="w-full min-h-[190px] p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex flex-col items-center justify-center transition-all">
                {generatorType === 'BARCODE' ? (
                  <BarcodeRenderer
                    id={`carousel-barcode-${currentCarouselItem.id}`}
                    value={currentCarouselItem.code}
                    format={barcodeFormat}
                    width={2.4}
                    height={100}
                    fontSize={18}
                    className="py-2"
                  />
                ) : (
                  <QRCodeSVG
                    id={`carousel-qr-${currentCarouselItem.id}`}
                    value={currentCarouselItem.code}
                    size={175}
                    level="M"
                    includeMargin={true}
                  />
                )}
              </div>

              {/* Display Number & Description */}
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black font-mono tracking-widest text-slate-900 dark:text-white">
                    {currentCarouselItem.code}
                  </span>
                  <button
                    onClick={() => handleCopyCode(currentCarouselItem.code)}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg transition-all active:scale-95"
                    title="Copiar este código"
                  >
                    {copiedCurrent ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {currentCarouselItem.description && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {currentCarouselItem.description}
                  </span>
                )}
              </div>

              {/* Navigation Controls Bar */}
              <div className="flex items-center gap-2 w-full pt-2">
                <button
                  onClick={handlePrevSlide}
                  className="p-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-bold transition-all active:scale-95 border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                  title="Anterior (Seta Esquerda)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* Auto Play Toggle */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-5 h-5 fill-current" />
                      <span>Pausar Auto</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Iniciar Auto ({autoDelaySeconds}s)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNextSlide}
                  className="p-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-bold transition-all active:scale-95 border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                  title="Próximo (Seta Direita / Espaço)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Auto Slide Settings Box */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-left space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <span>Intervalo do Carrossel Automático:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5, 10].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setAutoDelaySeconds(sec)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                          autoDelaySeconds === sec
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loopContinuous}
                      onChange={(e) => setLoopContinuous(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Reiniciar do início ao terminar (Loop)</span>
                  </label>

                  <span className="font-mono text-[9px] text-slate-400">Teclas: ⬅️ ➡️</span>
                </div>
              </div>

              {/* Download Buttons for Current Carousel Item */}
              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <button
                  onClick={() =>
                    handleDownloadSvg(
                      currentCarouselItem.code,
                      `codigo_${currentCarouselItem.code}`,
                      generatorType === 'BARCODE'
                        ? `carousel-barcode-${currentCarouselItem.id}`
                        : `carousel-qr-${currentCarouselItem.id}`
                    )
                  }
                  className="py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar SVG</span>
                </button>

                <button
                  onClick={() =>
                    handleDownloadPng(
                      currentCarouselItem.code,
                      `codigo_${currentCarouselItem.code}`,
                      generatorType === 'BARCODE'
                        ? `carousel-barcode-${currentCarouselItem.id}`
                        : `carousel-qr-${currentCarouselItem.id}`
                    )
                  }
                  className="py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PNG</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW MODE 2: GRID OF ALL CARDS                                      */}
        {/* =================================================================== */}
        {parsedItems.length > 0 && viewMode === 'GRID' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 print:hidden">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] flex items-center gap-1">
                <Grid className="w-3.5 h-3.5" />
                <span>Lista de Etiquetas ({parsedItems.length})</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2 print:gap-4 print:p-0">
              {parsedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center space-y-3 shadow-xs print:border print:border-black print:p-3 print:rounded-lg"
                >
                  {/* Graphic */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center w-full min-h-[110px]">
                    {generatorType === 'BARCODE' ? (
                      <BarcodeRenderer
                        id={`grid-barcode-${item.id}`}
                        value={item.code}
                        format={barcodeFormat}
                        width={2}
                        height={60}
                        fontSize={14}
                      />
                    ) : (
                      <QRCodeSVG
                        id={`grid-qr-${item.id}`}
                        value={item.code}
                        size={120}
                        level="M"
                        includeMargin={true}
                      />
                    )}
                  </div>

                  {/* Code Title / Description */}
                  <div className="space-y-0.5 w-full">
                    <span className="text-xs font-black font-mono text-slate-900 dark:text-slate-100 block tracking-wider break-all">
                      {item.code}
                    </span>
                    {item.description && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate max-w-full">
                        {item.description}
                      </span>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-1.5 pt-1 w-full print:hidden">
                    <button
                      onClick={() => handleCopyCode(item.code, index)}
                      className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                      title="Copiar Código"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedIndex === index ? 'OK' : 'Copiar'}</span>
                    </button>

                    <button
                      onClick={() =>
                        handleDownloadSvg(
                          item.code,
                          `codigo_${item.code}`,
                          generatorType === 'BARCODE' ? `grid-barcode-${item.id}` : `grid-qr-${item.id}`
                        )
                      }
                      className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold transition-all"
                      title="Baixar SVG"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW MODE 3: SINGLE COMBINED MASTER QR CODE                         */}
        {/* =================================================================== */}
        {parsedItems.length > 0 && viewMode === 'SINGLE_COMBINED' && generatorType === 'QRCODE' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl print:border print:border-black print:p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                <ScanLine className="w-4 h-4" />
                <span>QR Code Único com todos os {parsedItems.length} itens</span>
              </div>

              {/* Master QR Code Graphic */}
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center">
                <QRCodeSVG
                  id="qr-svg-combined-master"
                  value={currentQrValue}
                  size={210}
                  level="M"
                  includeMargin={true}
                />
              </div>

              {/* Format Selector Tabs */}
              <div className="w-full grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold print:hidden">
                <button
                  onClick={() => setCombinedFormat('TRANSMISSION')}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    combinedFormat === 'TRANSMISSION'
                      ? 'bg-blue-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                  title="Formato otimizado JSON para transmissão de base"
                >
                  Transmissão Base
                </button>
                <button
                  onClick={() => setCombinedFormat('EXACT_PASTE')}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    combinedFormat === 'EXACT_PASTE'
                      ? 'bg-blue-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                  title="Preserva exatamente as quebras de linha e espaços do texto colado"
                >
                  Como Colado
                </button>
                <button
                  onClick={() => setCombinedFormat('ONE_PER_LINE')}
                  className={`py-1.5 px-2 rounded-lg transition-all ${
                    combinedFormat === 'ONE_PER_LINE'
                      ? 'bg-blue-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                  title="Coloca exatamente um número por linha"
                >
                  Um por Linha
                </button>
              </div>

              {/* Chunk Selector if Multi-Part */}
              {qrChunks.length > 1 && (
                <div className="w-full space-y-2 pt-1 print:hidden">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                    Conteúdo extenso ({combinedPayload.length} chars) — Dividido em {qrChunks.length} partes:
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {qrChunks.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveChunkIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          activeChunkIndex === idx
                            ? 'bg-amber-500 text-black font-black'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200'
                        }`}
                      >
                        Parte {idx + 1}/{qrChunks.length}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Information Payload Banner */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 text-left space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span>Itens incluídos neste QR:</span>
                  <span>{parsedItems.length} códigos</span>
                </div>

                <div className="text-[11px] font-mono text-slate-800 dark:text-slate-200 font-bold break-all line-clamp-3 bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  {parsedItems.map((i) => i.code).join(', ')}
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 font-medium italic">
                  💡 Ao escanear este único QR Code no leitor do aplicativo, todos os {parsedItems.length} números serão importados instantaneamente.
                </p>
              </div>

              {/* Download Master SVG */}
              <div className="w-full print:hidden">
                <button
                  onClick={() => handleDownloadSvg(parsedItems[0]?.code || 'todos', `qrcode_consolidado_${parsedItems.length}_itens`, 'qr-svg-combined-master')}
                  className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Imagem deste QR Único (.SVG)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no items entered */}
        {parsedItems.length === 0 && (
          <div className="p-8 text-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl space-y-3 print:hidden">
            <BarcodeIcon className="w-12 h-12 text-[var(--text-dim)] mx-auto opacity-50" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Nenhum código para gerar</h3>
            <p className="text-xs text-[var(--text-dim)] max-w-[260px] mx-auto leading-relaxed">
              Cole códigos no campo acima (exemplo: <strong>2231212 2231213 2231214</strong>) para apresentar em carrossel ou gerar a grade de etiquetas para download.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
