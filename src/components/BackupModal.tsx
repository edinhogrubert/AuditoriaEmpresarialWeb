import React, { useState, useRef } from 'react';
import { X, Database, Download, Upload, QrCode, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { generateFullBackup, restoreBackup, createQrChunks } from '../utils/qrChunker';

interface BackupModalProps {
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ onClose }) => {
  const [activeStep, setActiveStep] = useState<'MENU' | 'QR_EXPORT' | 'FILE_IMPORT'>('MENU');
  const [qrChunks, setQrChunks] = useState<string[]>([]);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(0);

  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackupFile = () => {
    const backup = generateFullBackup();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `inventario_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleTriggerQrExport = () => {
    const backup = generateFullBackup();
    const chunks = createQrChunks(backup, 260); // Keep chunks small enough for dense screens
    setQrChunks(chunks);
    setCurrentChunkIdx(0);
    setActiveStep('QR_EXPORT');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onerror = () => setErrorMsg('Erro de leitura física do arquivo.');
    reader.onload = () => {
      try {
        const backupData = JSON.parse(reader.result as string);
        if (!backupData.batches) {
          throw new Error('Formato de arquivo inválido. Lista de lotes ausente.');
        }

        const stats = restoreBackup(backupData, importMode);
        setSuccessMsg(
          `Importação concluída com sucesso (${importMode === 'REPLACE' ? 'Substituição' : 'Mesclagem'}). Foram carregados ${stats.importedBatchesCount} lotes, ${stats.importedExpectedCount} itens de auditoria e ${stats.importedItemsCount} leituras.`
        );
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao decodificar JSON de backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-50">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] w-full max-w-sm p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]/60">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-wider">Cópia de Segurança</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-dim)] hover:bg-[var(--bg-primary)] rounded-full transition-all"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* STEP 1: OPTIONS MENU */}
        {activeStep === 'MENU' && (
          <div className="space-y-3.5">
            <p className="text-xs font-semibold text-[var(--text-secondary)] leading-relaxed">
              Exporte seus dados para salvaguarda, ou mescle backups de outros dispositivos off-line.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleDownloadBackupFile}
                className="w-full py-4 bg-[var(--bg-primary)] hover:bg-[var(--border-color)]/40 border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4.5 h-4.5 text-emerald-400" />
                <span>Salvar Arquivo de Backup</span>
              </button>

              <button
                onClick={handleTriggerQrExport}
                className="w-full py-4 bg-[var(--bg-primary)] hover:bg-[var(--border-color)]/40 border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <QrCode className="w-4.5 h-4.5 text-orange-400" />
                <span>Transmitir via QR Code</span>
              </button>

              <button
                onClick={() => setActiveStep('FILE_IMPORT')}
                className="w-full py-4 bg-[#002b59] dark:bg-sky-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Upload className="w-4.5 h-4.5" />
                <span>Restaurar / Importar</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MULTI-PART ANIMATED QR TRANSMISSION */}
        {activeStep === 'QR_EXPORT' && (
          <div className="space-y-4 flex flex-col items-center text-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/20">
              Parte {currentChunkIdx + 1} de {qrChunks.length}
            </span>

            {/* Live QR element */}
            <div className="p-4 bg-white rounded-3xl border-2 border-[var(--border-color)] shadow-inner">
              <QRCodeSVG
                value={qrChunks[currentChunkIdx] || ''}
                size={180}
                level="L"
                includeMargin={false}
              />
            </div>

            <p className="text-[10px] text-[var(--text-dim)] font-medium max-w-[240px]">
              Aponte a câmera do dispositivo receptor para este QR Code. Use os controles abaixo para avançar as partes.
            </p>

            {/* Slider triggers */}
            <div className="flex gap-4 items-center justify-between w-full pt-2">
              <button
                disabled={currentChunkIdx === 0}
                onClick={() => setCurrentChunkIdx(prev => prev - 1)}
                className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--text-primary)]" />
              </button>

              <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                {currentChunkIdx + 1} / {qrChunks.length}
              </span>

              <button
                disabled={currentChunkIdx === qrChunks.length - 1}
                onClick={() => setCurrentChunkIdx(prev => prev + 1)}
                className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-[var(--text-primary)]" />
              </button>
            </div>

            <button
              onClick={() => setActiveStep('MENU')}
              className="text-xs font-bold text-blue-400 hover:underline pt-2"
            >
              ‹ Voltar ao Menu
            </button>
          </div>
        )}

        {/* STEP 3: FILE RESTORATION / MERGE */}
        {activeStep === 'FILE_IMPORT' && (
          <div className="space-y-4">
            {successMsg ? (
              <div className="space-y-3 flex flex-col items-center text-center text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
                <h4 className="text-xs font-black uppercase tracking-wider">Restauração Completa</h4>
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] leading-relaxed">{successMsg}</p>
                <button
                  onClick={onClose}
                  className="w-full mt-4 py-3 bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs font-bold text-red-400">
                    {errorMsg}
                  </div>
                )}

                {/* Import Strategy Selectors */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                    Estratégia de Integração
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => setImportMode('MERGE')}
                      className={`py-2 text-[10px] font-bold rounded-lg transition-all ${
                        importMode === 'MERGE'
                          ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Mesclar Sem Perda
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('REPLACE')}
                      className={`py-2 text-[10px] font-bold rounded-lg transition-all ${
                        importMode === 'REPLACE'
                          ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Substituir Tudo
                    </button>
                  </div>
                </div>

                {/* File selector box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-color)] hover:border-gray-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[var(--bg-primary)]/50"
                >
                  <Upload className="w-8 h-8 text-blue-400 mb-2" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Upload de arquivo .JSON</span>
                  <p className="text-[9px] text-[var(--text-dim)] mt-1 font-medium">Toque para selecionar do dispositivo</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]/60">
                  <button
                    onClick={() => setActiveStep('MENU')}
                    className="flex-1 py-3 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
