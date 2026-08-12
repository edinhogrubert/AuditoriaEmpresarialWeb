import React, { useState } from 'react';
import { ArrowLeft, Play, Square, FileText } from 'lucide-react';
import { Batch } from '../types';
import { processScanItem, getAuditStatsForBatch, getStoredSettings } from '../services/storage';
import { CameraScanner } from './CameraScanner';

interface VerificationScanScreenProps {
  batch: Batch;
  onBack: () => void;
  onViewAuditResults: () => void;
}

export const VerificationScanScreen: React.FC<VerificationScanScreenProps> = ({
  batch,
  onBack,
  onViewAuditResults,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Status results states
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'FOUND' | 'DUPLICATE' | 'EXTRA' | 'ADDED'>('IDLE');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [matchedDesc, setMatchedDesc] = useState('');
  const [matchedCode, setMatchedCode] = useState('');

  const stats = getAuditStatsForBatch(batch.id);

  const handleScan = (barcode: string, format: string) => {
    setIsScanning(false);
    triggerVerification(barcode, format);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    triggerVerification(manualCode.trim(), 'MANUAL');
    setManualCode('');
  };

  const triggerVerification = (barcode: string, format: string) => {
    const res = processScanItem(batch.id, barcode, format);
    setScanStatus(res.status);
    setFeedbackMsg(res.message);
    setMatchedCode(barcode);

    if (res.expectedItem) {
      setMatchedDesc(res.expectedItem.description || 'Item de Inventário');
    } else {
      setMatchedDesc(res.status === 'EXTRA' ? 'Sobra de Estoque / Não cadastrado' : '');
    }

    // Beep / Sound options based on settings
    const settings = getStoredSettings();
    if (settings.scanBeep) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Success vs Alert frequency
        if (res.status === 'FOUND' || res.status === 'ADDED') {
          osc.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch success
          gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(250, audioCtx.currentTime); // Low pitch error/duplicate warning
          gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        }
      } catch (e) {
        console.error('Audio beep failed', e);
      }
    }
  };

  const getStatusColor = () => {
    switch (scanStatus) {
      case 'FOUND':
        return 'border-emerald-500 bg-emerald-500/10 text-emerald-400';
      case 'DUPLICATE':
        return 'border-amber-500 bg-amber-500/10 text-amber-400';
      case 'EXTRA':
        return 'border-red-500 bg-red-500/10 text-red-400';
      default:
        return 'border-gray-800 bg-[#1A1F26]';
    }
  };

  return (
    <div className={`relative w-full h-screen text-white flex flex-col select-none overflow-hidden max-w-md mx-auto ${isScanning ? 'bg-transparent' : 'bg-[#0A0D14]'}`}>
      {/* Top Header */}
      <div className={`absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between ${isScanning ? 'bg-gradient-to-b from-black/80 to-transparent' : ''}`}>
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#1A1F26]/80 text-white border border-gray-800 backdrop-blur-md active:scale-95 transition-all shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1 px-3">
          <h2 className="text-sm font-bold text-white truncate uppercase tracking-tight">{batch.name}</h2>
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block mt-0.5">
            CONFERÊNCIA ({stats.foundCount}/{stats.totalExpected})
          </span>
        </div>
        <button
          onClick={onViewAuditResults}
          className="p-2.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md active:scale-95 transition-all shadow-lg"
          title="Resultados"
        >
          <FileText className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Scanner Container */}
      <div className="relative flex-1 w-full h-full">
        <CameraScanner onScan={handleScan} active={isScanning} />
      </div>

      {/* Control Drawer Container */}
      <div className={`absolute bottom-0 inset-x-0 z-40 bg-[#1A1F26]/95 backdrop-blur-xl border-t border-gray-800 flex flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${isScanning ? 'translate-y-[35vh]' : 'translate-y-0'}`}>

        {/* Toggle Laser Button */}
        <div className="absolute -top-10 inset-x-0 flex justify-center pointer-events-none">
          <button
            onClick={() => {
              setIsScanning(!isScanning);
              if (!isScanning) setScanStatus('IDLE');
            }}
            className={`pointer-events-auto px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl active:scale-95 flex items-center gap-3 border-2 ${
              isScanning
                ? 'bg-red-500/20 text-red-400 border-red-500/30 backdrop-blur-md'
                : 'bg-blue-600 text-white border-blue-500 shadow-[0_0_25px_rgba(37,99,235,0.4)]'
            }`}
          >
            {isScanning ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Parar Câmera
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Iniciar Câmera
              </>
            )}
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 max-h-[45vh]">
          <div className="px-1">
            <span className="text-[9px] font-mono font-bold bg-[#0A0D14] text-blue-400 px-2 py-0.5 rounded-md border border-gray-800 shadow-xs inline-block">
              VerificationScanScreen.tsx
            </span>
          </div>
          {/* Audit Scan Alert Panel */}
          {scanStatus !== 'IDLE' && (
            <div className={`border rounded-2xl p-4 space-y-1.5 shadow-sm ${getStatusColor()}`}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-wider opacity-90">
                  {scanStatus === 'FOUND' ? 'CONFERIDO' : scanStatus === 'DUPLICATE' ? 'ALERTA DE DUPLICADO' : 'SOBRA / NÃO CADASTRADO'}
                </span>
                <span className="text-xs font-mono font-bold">{matchedCode}</span>
              </div>
              <h4 className="text-sm font-bold truncate">{feedbackMsg}</h4>
              {matchedDesc && (
                <p className="text-[11px] opacity-80 font-semibold truncate pt-1 border-t border-current/10">
                  {matchedDesc}
                </p>
              )}
            </div>
          )}

          {/* Form manual input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digitar patrimônio para conferência..."
              className="flex-1 px-4 py-3.5 bg-[#0A0D14] border border-gray-800 text-sm font-semibold rounded-xl focus:outline-none focus:border-blue-500 text-white"
            />
            <button
              type="submit"
              className="px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-95 shrink-0"
            >
              Conferir
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
