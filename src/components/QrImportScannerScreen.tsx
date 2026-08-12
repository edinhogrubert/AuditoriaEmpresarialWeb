import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Square, QrCode, AlertTriangle, CheckCircle2, Image as ImageIcon, FileCode, Clipboard, Upload } from 'lucide-react';
import { CameraScanner } from './CameraScanner';
import { parseQrChunk, combineQrChunks, restoreBackup, importAnyJsonData } from '../utils/qrChunker';
import { decodeQrFromImageFile } from '../utils/qrImageDecoder';
import { addExpectedItemsToBatch, createBatch } from '../services/storage';

interface QrImportScannerScreenProps {
  batchName: string;
  onBack: () => void;
  onImported: (batchId: number) => void;
  onAddExpectedToBatch: (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => void;
  targetBatchId?: number;
  settings: any;
  initialContent?: string;
}

export const QrImportScannerScreen: React.FC<QrImportScannerScreenProps> = ({
  batchName,
  onBack,
  onImported,
  onAddExpectedToBatch,
  targetBatchId,
  settings,
  initialContent,
}) => {
  // Start scanning automatically on screen load to prompt camera permission
  const [isScanning, setIsScanning] = useState(true);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [totalParts, setTotalParts] = useState<number>(0);

  // Maps part numbers to text chunks
  const [chunksMap, setChunksMap] = useState<Map<number, string>>(new Map());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleQrPayload = useCallback((rawText: string) => {
    setErrorMsg(null);
    const parsed = parseQrChunk(rawText);

    if (!parsed.isChunk) {
      // Direct single code string containing JSON or plain list
      try {
        const data = JSON.parse(parsed.rawText);
        const stats = importAnyJsonData(data, batchName);
        setSuccessMsg(`Sucesso! Importado(s) ${stats.importedBatchesCount || 1} lote(s), ${stats.importedExpectedCount} item(ns).`);
        setTimeout(() => {
          onImported(stats.batchId || targetBatchId || Date.now());
        }, 2000);
      } catch (e) {
        // Plain newline/comma/semicolon split
        const lines = parsed.rawText.split(/[\n,;]/).map(x => x.trim()).filter(x => x.length > 1);
        if (lines.length > 0) {
          const items = lines.map(c => ({ barcode: c, description: 'Lido da Tela', category: 'QR Tela' }));
          if (targetBatchId) {
             onAddExpectedToBatch(targetBatchId, items);
             onImported(targetBatchId);
          } else {
             const b = createBatch(batchName, 'Importado via QR na Tela', 'VERIFICATION', items);
             onImported(b.id);
          }
        } else {
          setErrorMsg('Erro ao processar QR Code. Certifique-se de que o QR contenha um JSON ou lista de patrimônios válida.');
        }
      }
      return;
    }

    // Dynamic chunk assembly handler
    if (activeTransferId && activeTransferId !== parsed.transferId) {
      if (confirm('Atenção: Novo pareamento detectado. Descartar progresso anterior?')) {
        setChunksMap(new Map());
        setActiveTransferId(parsed.transferId);
        setTotalParts(parsed.totalParts);
      } else {
        return;
      }
    } else if (!activeTransferId) {
      setActiveTransferId(parsed.transferId);
      setTotalParts(parsed.totalParts);
    }

    setChunksMap((prev) => {
      const nextMap = new Map<number, string>(prev);
      nextMap.set(parsed.currentPart, parsed.chunkData);

      // Check if completely finished
      if (nextMap.size === parsed.totalParts) {
        setIsScanning(false);
        try {
          const joinedPayload = combineQrChunks(nextMap, parsed.totalParts);
          const backupJson = JSON.parse(joinedPayload);
          const stats = importAnyJsonData(backupJson, batchName);

          setSuccessMsg(`Transferência Concluída: ${stats.importedBatchesCount || 1} lote(s), ${stats.importedExpectedCount} itens.`);
          setTimeout(() => {
            const bId = stats.batchId || backupJson.batches?.[0]?.id || targetBatchId || Date.now();
            onImported(bId);
          }, 2500);
        } catch (err: any) {
          setErrorMsg(`Erro de reconstrução: ${err.message}`);
        }
      }

      return nextMap;
    });
  }, [activeTransferId, batchName, onAddExpectedToBatch, onImported, targetBatchId]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const scannedText = await decodeQrFromImageFile(file);
      handleQrPayload(scannedText);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao decodificar QR Code da imagem da tela.');
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    const reader = new FileReader();
    reader.onerror = () => setErrorMsg('Erro ao ler arquivo .JSON.');
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const stats = importAnyJsonData(parsed, batchName);
        setSuccessMsg(`Lote .JSON importado com sucesso: ${stats.importedBatchesCount || 1} lote(s), ${stats.importedExpectedCount} item(ns).`);
        setTimeout(() => {
          onImported(stats.batchId || targetBatchId || Date.now());
        }, 2200);
      } catch (err: any) {
        setErrorMsg(err.message || 'Formato de arquivo .JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    setShowPasteModal(false);
    handleQrPayload(pasteText.trim());
    setPasteText('');
  };

  // Handle initial scan input if triggered immediately from paste
  React.useEffect(() => {
    if (initialContent) {
      handleQrPayload(initialContent);
    }
  }, [initialContent, handleQrPayload]);

  return (
    <div className={`relative w-full h-screen text-white flex flex-col select-none overflow-hidden max-w-md mx-auto ${isScanning ? 'bg-transparent' : 'bg-[#0A0D14]'}`}>
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={jsonInputRef}
        onChange={handleJsonFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Top Header */}
      <div className={`absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between ${isScanning ? 'bg-gradient-to-b from-black/80 to-transparent' : ''}`}>
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#1A1F26]/80 text-white border border-gray-800 backdrop-blur-md active:scale-95 transition-all shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm font-bold text-white tracking-wide truncate max-w-[190px]">
            Conectar Lote (Tela / QR)
          </h2>
          {totalParts > 0 && (
            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mt-0.5 block">
              Progresso: {chunksMap.size} de {totalParts} partes
            </span>
          )}
        </div>
        <div className="w-10"></div>
      </div>

      {/* Main viewport */}
      <div className="relative flex-1 w-full h-full">
        <CameraScanner onScan={handleQrPayload} active={isScanning} />

        {/* Manual Start / Option Buttons */}
        {!isScanning && !successMsg && !errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20 bg-black/60 backdrop-blur-xs space-y-6">
            <div className="text-center space-y-2 max-w-[280px]">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto shadow-lg">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wide text-white">Importar Lote de Celular</h3>
              <p className="text-xs text-gray-400 font-medium">
                Leia o QR Code diretamente da tela de outro celular ou carregue o arquivo .JSON.
              </p>
            </div>

            <div className="w-full space-y-3 max-w-[320px]">
              <button
                onClick={() => setIsScanning(true)}
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-black font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2.5"
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                <span>Escanear Tela com Câmera</span>
              </button>

              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full py-3.5 rounded-2xl bg-[#1A1F26] hover:bg-gray-800 text-white border border-gray-800 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Carregar Foto/Screenshot da Tela</span>
              </button>

              <button
                onClick={() => jsonInputRef.current?.click()}
                className="w-full py-3.5 rounded-2xl bg-[#1A1F26] hover:bg-gray-800 text-white border border-gray-800 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Importar Arquivo .JSON do Celular</span>
              </button>

              <button
                onClick={() => setShowPasteModal(true)}
                className="w-full py-2.5 text-xs text-gray-400 hover:text-white font-semibold underline text-center block pt-1"
              >
                Ou colar código/JSON direto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1A1F26] border border-gray-800 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-orange-400" />
              <span>Colar Conteúdo QR / JSON</span>
            </h3>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Cole aqui o texto do QR Code ou JSON recebido..."
              rows={5}
              className="w-full p-3 bg-black/50 border border-gray-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="flex-1 py-3 bg-gray-800 rounded-xl text-xs font-bold text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasteSubmit}
                className="flex-1 py-3 bg-orange-500 text-black font-bold text-xs rounded-xl"
              >
                Processar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results / Progress visual feedback overlays & Quick Action Toolbar */}
      <div className="absolute bottom-6 inset-x-4 z-40 bg-[#1A1F26]/95 backdrop-blur-md border border-gray-800 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center gap-2 text-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <h4 className="text-xs font-black uppercase tracking-wider">Sucesso Total</h4>
            <p className="text-[11px] font-semibold">{successMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col items-center gap-2 text-center text-red-400">
            <AlertTriangle className="w-8 h-8" />
            <h4 className="text-xs font-black uppercase tracking-wider">Falha de Leitura</h4>
            <p className="text-[11px] font-semibold">{errorMsg}</p>
            <div className="flex gap-2 w-full pt-1">
              <button
                onClick={() => { setErrorMsg(null); setIsScanning(true); }}
                className="flex-1 text-xs font-bold text-white bg-red-600 py-2.5 rounded-xl active:scale-95 transition-all"
              >
                Tentar Câmera
              </button>
              <button
                onClick={() => { setErrorMsg(null); imageInputRef.current?.click(); }}
                className="flex-1 text-xs font-bold text-white bg-gray-800 py-2.5 rounded-xl active:scale-95 transition-all"
              >
                Usar Foto da Tela
              </button>
            </div>
          </div>
        )}

        {!successMsg && !errorMsg && totalParts > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold text-gray-400">
              <span>Transfer ID: {activeTransferId}</span>
              <span>{Math.round((chunksMap.size / totalParts) * 100)}%</span>
            </div>

            {/* Micro grid parts checker indicator */}
            <div className="flex flex-wrap gap-1.5 justify-center py-2">
              {Array.from({ length: totalParts }).map((_, index) => {
                const partNum = index + 1;
                const isRead = chunksMap.has(partNum);

                return (
                  <span
                    key={partNum}
                    className={`w-7 h-7 rounded-lg font-bold text-[10px] flex items-center justify-center border transition-colors ${
                      isRead
                        ? 'bg-orange-500 border-orange-400 text-black shadow-inner font-extrabold'
                        : 'bg-black/60 border-gray-800 text-gray-500'
                    }`}
                  >
                    {partNum}
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-center text-gray-400 italic">
              Aponte a câmera para os QR codes na tela do outro celular.
            </p>
          </div>
        )}

        {/* Quick Toolbar during scanning */}
        {!successMsg && !errorMsg && isScanning && (
          <div className="flex items-center justify-around pt-1 border-t border-gray-800/80">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-gray-300 hover:text-sky-400 transition-colors p-1.5"
            >
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>Usar Foto</span>
            </button>

            <button
              onClick={() => jsonInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-gray-300 hover:text-emerald-400 transition-colors p-1.5"
            >
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>Arquivo .JSON</span>
            </button>

            <button
              onClick={() => setShowPasteModal(true)}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-gray-300 hover:text-amber-400 transition-colors p-1.5"
            >
              <Clipboard className="w-4 h-4 text-amber-400" />
              <span>Colar</span>
            </button>

            <button
              onClick={() => setIsScanning(false)}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white transition-colors p-1.5"
            >
              <Square className="w-4 h-4 text-red-400" />
              <span>Pausar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

