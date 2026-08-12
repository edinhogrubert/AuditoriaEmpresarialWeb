import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  FileSpreadsheet,
  QrCode,
  Upload,
  Play,
  FileCheck2,
  CheckCircle2,
  Target,
} from 'lucide-react';
import { Batch } from '../types';
import { addScannedItemsToBatch, createBatch, getAllAssetRecords } from '../services/storage';

interface ImportInventoryScreenProps {
  onBack: () => void;
  onCreateVerificationBatch: (
    name: string,
    description: string,
    expectedItems: { barcode: string; description?: string; category?: string }[]
  ) => void;
  onAddExpectedToBatch: (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => void;
  onNavigateQrImport: (batchName: string, targetId?: number, initialContent?: string) => void;
  onNavigate: (screen: string) => void;
  onOpenBatchDetails: (batchId: number) => void;
  onOpenQrGenerator?: (initialText?: string) => void;
  targetBatchId: number | null;
  settings: any;
}

export const ImportInventoryScreen: React.FC<ImportInventoryScreenProps> = ({
  onBack,
  onCreateVerificationBatch,
  onAddExpectedToBatch,
  onNavigateQrImport,
  onNavigate,
  onOpenBatchDetails,
  onOpenQrGenerator,
  targetBatchId,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE' | 'QR'>('FILE');
  const [importTarget, setImportTarget] = useState<'EXPECTED' | 'COLLECTED'>('EXPECTED');
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');
  const [rawPaste, setRawPaste] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAppendMode = targetBatchId !== null && targetBatchId !== undefined;

  // Smart parser: extracts codes and looks up description/category in Asset Bank
  const parseCodeList = (text: string) => {
    const lines = text.split('\n');
    const parsed: { barcode: string; description?: string; category?: string }[] = [];

    const assetRecords = getAllAssetRecords();
    const assetMap = new Map<string, { description: string; category: string }>();
    assetRecords.forEach((a) => {
      if (a.barcode && !assetMap.has(a.barcode.toLowerCase())) {
        assetMap.set(a.barcode.toLowerCase(), { description: a.description, category: a.category });
      }
    });

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Split by tab, semicolon, comma or piping
      const parts = trimmed.split(/[\t;|,]/);

      if (parts.length > 0) {
        const barcode = parts[0].trim();
        if (barcode && barcode.length >= 1) {
          const dbMatch = assetMap.get(barcode.toLowerCase());
          const desc = parts[1]?.trim() || dbMatch?.description || `Ativo ${barcode}`;
          const cat = parts[2]?.trim() || dbMatch?.category || 'Geral';

          parsed.push({
            barcode,
            description: desc,
            category: cat,
          });
        }
      }
    });

    return parsed;
  };

  const handleImportSuccess = (items: { barcode: string; description?: string; category?: string }[]) => {
    if (importTarget === 'EXPECTED') {
      if (isAppendMode) {
        onAddExpectedToBatch(targetBatchId, items);
      } else {
        const finalName = batchName.trim() || `Auditoria - ${new Date().toLocaleDateString()}`;
        onCreateVerificationBatch(finalName, description, items);
      }
    } else {
      // Import as COLLECTED / SCANNED DIRECT
      if (isAppendMode) {
        addScannedItemsToBatch(targetBatchId, items);
        onOpenBatchDetails(targetBatchId);
      } else {
        const finalName = batchName.trim() || `Lote Coleta - ${new Date().toLocaleDateString()}`;
        const newBatch = createBatch(finalName, description, 'COLLECTION');
        addScannedItemsToBatch(newBatch.id, items);
        onOpenBatchDetails(newBatch.id);
      }
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAppendMode && !batchName.trim()) {
      setError('Por favor, informe o nome do lote.');
      return;
    }

    if (!rawPaste.trim()) {
      setError('Cole os códigos de patrimônio antes de continuar.');
      return;
    }

    const items = parseCodeList(rawPaste);

    if (items.length === 0) {
      setError('Nenhum código válido encontrado no texto colado. Certifique-se de colocar um código por linha.');
      return;
    }

    handleImportSuccess(items);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Erro ao ler o arquivo selecionado.');
      setLoading(false);
    };

    reader.onload = () => {
      try {
        const text = reader.result as string;
        let items: { barcode: string; description?: string; category?: string }[] = [];

        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(text);
          const rawItems = Array.isArray(parsedJson) ? parsedJson : parsedJson.expected || parsedJson.items || [];
          items = rawItems
            .map((i: any) => ({
              barcode: String(i.barcode || i.code || i.id || '').trim(),
              description: String(i.description || i.desc || i.nome || '').trim(),
              category: String(i.category || i.grupo || i.setor || '').trim(),
            }))
            .filter((i: any) => i.barcode.length > 0);
        } else {
          // Parse standard TXT or CSV
          items = parseCodeList(text);
        }

        if (items.length === 0) {
          throw new Error('Nenhum item/código válido encontrado no arquivo.');
        }

        handleImportSuccess(items);
      } catch (err: any) {
        setError(err.message || 'Falha ao processar arquivo. Verifique se a formatação (JSON, CSV, TXT) está correta.');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-6 select-none shadow-xl border-x border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border-color)] shrink-0">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight">
            {isAppendMode ? 'Anexar ao Lote' : 'Nova Auditoria'}
          </h1>
          <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest mt-0.5 block">
            {isAppendMode ? 'Incluir mais bens esperados' : 'Carregar lista de patrimônios'}
          </span>
        </div>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden">
        <div className="px-1 mb-4">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            ImportInventoryScreen.tsx
          </span>
        </div>
        {/* Custom Tabs */}
        <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-2xl border border-[var(--border-color)] shadow-xs shrink-0 mb-6">
          {(
            [
              { id: 'FILE', label: 'Arquivo .JSON/.CSV' },
              { id: 'PASTE', label: 'Copiar/Colar' },
              { id: 'QR', label: 'Transferir do Celular' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError(null);
              }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Target Destination Selector */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-2xl mb-5 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] block">
            Destino da Carga / Tipo de Item:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setImportTarget('EXPECTED')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                importTarget === 'EXPECTED'
                  ? 'bg-blue-500/10 border-blue-500 text-[var(--text-primary)] shadow-xs'
                  : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-tight">A Serem Localizados</span>
              </div>
              <p className="text-[9px] font-medium opacity-80 leading-tight">
                Carga de matriz para auditoria/conferência.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setImportTarget('COLLECTED')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                importTarget === 'COLLECTED'
                  ? 'bg-emerald-500/10 border-emerald-500 text-[var(--text-primary)] shadow-xs'
                  : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-tight">Já Localizados</span>
              </div>
              <p className="text-[9px] font-medium opacity-80 leading-tight">
                Coleta de campo / itens já bipados.
              </p>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs font-bold text-red-400 mb-6">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6">
          {/* Section: Common Metadata fields (Only for creating a new batch) */}
          {!isAppendMode && activeTab !== 'QR' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                  Nome da Auditoria *
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Ex: Auditoria Bloco Administrativo"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                  Setor / Notas (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instruções para a equipe, local ou meta..."
                  rows={2}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)] resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 1: FILE IMPORT */}
          {activeTab === 'FILE' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-color)] hover:border-gray-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[var(--bg-secondary)]/50"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/20 flex items-center justify-center mb-4 shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {loading ? 'Carregando Arquivo...' : 'Carregar .JSON, .CSV ou .TXT'}
                </h3>
                <p className="text-[10px] text-[var(--text-dim)] font-medium max-w-[220px] mt-2">
                  Suporta lotes em arquivos .JSON, planilhas .CSV ou .TXT.
                  Arraste ou toque para selecionar.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt,.json"
                  className="hidden"
                />
              </div>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Formatos Aceitos:
                </span>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-semibold">
                  • <strong className="text-[var(--text-primary)]">JSON:</strong> Arquivos de lote exportados ou listas de itens.<br />
                  • <strong className="text-[var(--text-primary)]">CSV / TXT:</strong> Linhas contendo <span className="font-mono text-xs">PATRIMÔNIO, DESCRIÇÃO, CATEGORIA</span>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: COPY & PASTE IMPORT */}
          {activeTab === 'PASTE' && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] flex justify-between">
                  <span>Conteúdo da Lista *</span>
                  <span className="text-blue-400 font-bold lowercase">1 item por linha</span>
                </label>
                <textarea
                  value={rawPaste}
                  onChange={(e) => setRawPaste(e.target.value)}
                  placeholder="PAT-1001, Notebook Dell, TI&#10;PAT-1002, Monitor LG, TI&#10;PAT-1003, Cadeira Ergo, Mobiliário"
                  rows={8}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono rounded-xl focus:outline-none focus:border-[var(--text-dim)] resize-none"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="submit"
                  className="w-full py-4 bg-[var(--color-blue)] text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <FileCheck2 className="w-4.5 h-4.5" />
                  <span>Analisar e Criar Auditoria</span>
                </button>

                {onOpenQrGenerator && (
                  <button
                    type="button"
                    onClick={() => onOpenQrGenerator(rawPaste || '2230110\n2230101')}
                    className="w-full py-3 bg-[var(--bg-secondary)] hover:bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-blue-500" />
                    <span>Gerar QR Codes com estes números</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* TAB 3: QR IMPORT */}
          {activeTab === 'QR' && (
            <div className="space-y-5 flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-[2rem] bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-sm">
                <QrCode className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Transferir Lote da Tela do Celular</h3>
                <p className="text-xs text-[var(--text-dim)] font-medium max-w-[280px]">
                  Envie ou receba lotes lendo o QR Code exibido na tela de outro celular ou importando o arquivo .JSON do lote.
                </p>
              </div>

              <div className="w-full space-y-4">
                {!isAppendMode && (
                  <div className="space-y-1.5 text-left w-full">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                      Nome do Lote
                    </label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Ex: Auditoria Recebida via QR / Tela"
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)]"
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    const finalName = batchName.trim() || 'Conferência QR Tela';
                    onNavigateQrImport(finalName, targetBatchId || undefined);
                  }}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Conectar Câmera / Ler da Tela / .JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
