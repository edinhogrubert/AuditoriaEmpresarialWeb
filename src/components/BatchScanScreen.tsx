import React, { useState } from 'react';
import { ArrowLeft, Play, Square, Eye, Sparkles } from 'lucide-react';
import { Batch, ScanItem } from '../types';
import { CameraScanner } from './CameraScanner';

interface BatchScanScreenProps {
  batch: Batch;
  scanItems: ScanItem[];
  onBack: () => void;
  onAddScanItem: (barcode: string, format: string) => void;
  onViewDetails: () => void;
}

export const BatchScanScreen: React.FC<BatchScanScreenProps> = ({
  batch,
  scanItems,
  onBack,
  onAddScanItem,
  onViewDetails,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleScan = (barcode: string, format: string) => {
    setIsScanning(false);
    onAddScanItem(barcode, format);
    triggerSuccess('Código inserido com sucesso!');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onAddScanItem(manualCode.trim(), 'MANUAL');
    setManualCode('');
    triggerSuccess('Código manual cadastrado!');
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const recentScans = scanItems.slice(0, 3);

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
          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block mt-0.5">
            Lote Simples ({scanItems.length} lidos)
          </span>
        </div>
        <button
          onClick={onViewDetails}
          className="p-2.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 backdrop-blur-md active:scale-95 transition-all shadow-lg"
          title="Ver Lista"
        >
          <Eye className="w-5 h-5" />
        </button>
      </div>

      {/* Main Camera Scanner Area */}
      <div className="relative flex-1 w-full h-full">
        <CameraScanner onScan={handleScan} active={isScanning} />
      </div>

      {/* Control Drawer Container */}
      <div className={`absolute bottom-0 inset-x-0 z-40 bg-[#1A1F26]/95 backdrop-blur-xl border-t border-gray-800 flex flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${isScanning ? 'translate-y-[35vh]' : 'translate-y-0'}`}>

        {/* Toggle Laser Button */}
        <div className="absolute -top-10 inset-x-0 flex justify-center pointer-events-none">
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`pointer-events-auto px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl active:scale-95 flex items-center gap-3 border-2 ${
              isScanning
                ? 'bg-red-500/20 text-red-400 border-red-500/30 backdrop-blur-md'
                : 'bg-purple-600 text-white border-purple-500 shadow-[0_0_25px_rgba(147,51,234,0.4)]'
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
            <span className="text-[9px] font-mono font-bold bg-[#0A0D14] text-purple-400 px-2 py-0.5 rounded-md border border-gray-800 shadow-xs inline-block">
              BatchScanScreen.tsx
            </span>
          </div>
          {/* Notification Overlay inside Drawer */}
          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-3 text-xs font-bold text-emerald-400 text-center animate-pulse shadow-sm">
              {successMsg}
            </div>
          )}

          {/* Form manual input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digitar código patrimonial..."
              className="flex-1 px-4 py-3.5 bg-[#0A0D14] border border-gray-800 text-sm font-semibold rounded-xl focus:outline-none focus:border-purple-500 text-white"
            />
            <button
              type="submit"
              className="px-5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-95 shrink-0"
            >
              Registrar
            </button>
          </form>

          {/* Recent Scans Drawer View */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
              Últimas Leituras
            </h3>
            {recentScans.length === 0 ? (
              <p className="text-xs text-gray-600 italic px-1">Nenhum registro no lote ainda.</p>
            ) : (
              <div className="space-y-2 max-y-[20vh] overflow-y-auto custom-scrollbar">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0A0D14] border border-gray-800/80 rounded-xl px-4 py-3.5 flex items-center justify-between"
                  >
                    <span className="font-mono text-xs font-bold truncate pr-3">{item.barcode}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.format}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
