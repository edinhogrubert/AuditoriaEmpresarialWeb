import React, { useState } from 'react';
import {
  X,
  QrCode,
  FileSpreadsheet,
  ClipboardList,
  Barcode,
  Upload,
  CheckCircle2,
  Plus,
  Boxes,
  Sparkles,
} from 'lucide-react';
import { Batch } from '../types';
import { CameraScanner } from './CameraScanner';
import {
  addExpectedItemsToBatch,
  addScannedItemsToBatch,
  processScanItem,
  getAllAssetRecords,
} from '../services/storage';

interface BatchInsertModalProps {
  batch: Batch;
  targetType: 'EXPECTED' | 'SCANNED'; // EXPECTED = Procurados/Buscados, SCANNED = Encontrados/Localizados
  onClose: () => void;
  onRefresh: () => void;
}

export const BatchInsertModal: React.FC<BatchInsertModalProps> = ({
  batch,
  targetType,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'paste' | 'csv' | 'manual'>('manual');

  // Manual single item state
  const [singleBarcode, setSingleBarcode] = useState('');
  const [singleDescription, setSingleDescription] = useState('');
  const [singleCategory, setSingleCategory] = useState('');

  // Paste raw text state
  const [pasteText, setPasteText] = useState('');

  // File import state
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<{ barcode: string; description?: string; category?: string }[]>([]);

  // Feed log for live camera scan
  const [cameraScanLogs, setCameraScanLogs] = useState<string[]>([]);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const isExpected = targetType === 'EXPECTED';
  const titleText = isExpected
    ? 'Importar Ativos a Buscar (Carga Inicial)'
    : 'Importar Leituras de Campo (Bips / Localizados)';

  // 1. Handle Single Manual Item Add
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const code = singleBarcode.trim();
    if (!code) return;

    if (isExpected) {
      const added = addExpectedItemsToBatch(batch.id, [
        {
          barcode: code,
          description: singleDescription.trim() || undefined,
          category: singleCategory.trim() || undefined,
        },
      ]);
      if (added > 0) {
        setSingleBarcode('');
        setSingleDescription('');
        setSingleCategory('');
        onRefresh();
      } else {
        alert('Item já existe na lista de procurados deste lote.');
      }
    } else {
      const result = processScanItem(batch.id, code, 'MANUAL');
      onRefresh();
      setSingleBarcode('');
      alert(result.message);
    }
  };

  // 2. Handle Paste Raw Text Add
  const handleProcessPaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split('\n');
    const items: { barcode: string; description?: string; category?: string }[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check comma or semicolon separated
      const delimiter = trimmed.includes(';') ? ';' : ',';
      const parts = trimmed.split(delimiter);

      const barcode = parts[0]?.trim();
      if (barcode && barcode.toLowerCase() !== 'barcode' && barcode.toLowerCase() !== 'codigo') {
        items.push({
          barcode,
          description: parts[1]?.trim(),
          category: parts[2]?.trim(),
        });
      }
    });

    if (items.length === 0) {
      alert('Nenhum código válido encontrado no texto colado.');
      return;
    }

    if (isExpected) {
      const added = addExpectedItemsToBatch(batch.id, items);
      onRefresh();
      alert(`Sucesso! ${added} item(ns) procurado(s) adicionado(s) ao lote.`);
      setPasteText('');
      onClose();
    } else {
      const added = addScannedItemsToBatch(
        batch.id,
        items.map((i) => ({ barcode: i.barcode, format: 'PASTE' }))
      );
      onRefresh();
      alert(`Sucesso! ${added} item(ns) localizado(s)/encontrado(s) registrado(s) no lote.`);
      setPasteText('');
      onClose();
    }
  };

  // 3. Handle File Upload (CSV, TXT, JSON)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let items: { barcode: string; description?: string; category?: string }[] = [];

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            items = json.map((j: any) => ({
              barcode: String(j.barcode || j.codigo || j.code || '').trim(),
              description: j.description || j.descricao,
              category: j.category || j.categoria,
            }));
          }
        } else {
          // CSV or TXT line by line
          const lines = text.split('\n');
          lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            const delimiter = trimmed.includes(';') ? ';' : ',';
            const parts = trimmed.split(delimiter);
            const code = parts[0]?.trim();

            if (code && code.toLowerCase() !== 'barcode' && code.toLowerCase() !== 'codigo') {
              items.push({
                barcode: code,
                description: parts[1]?.trim(),
                category: parts[2]?.trim(),
              });
            }
          });
        }

        const validItems = items.filter((i) => i.barcode.length > 0);
        setParsedItems(validItems);
      } catch (err) {
        alert('Erro ao analisar arquivo. Verifique o formato do arquivo.');
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmFileImport = () => {
    if (parsedItems.length === 0) return;

    if (isExpected) {
      const added = addExpectedItemsToBatch(batch.id, parsedItems);
      onRefresh();
      alert(`Sucesso! ${added} item(ns) procurado(s) importados para o lote.`);
      onClose();
    } else {
      const added = addScannedItemsToBatch(
        batch.id,
        parsedItems.map((i) => ({ barcode: i.barcode, format: 'FILE_CSV' }))
      );
      onRefresh();
      alert(`Sucesso! ${added} item(ns) localizado(s) importados e registrados no lote.`);
      onClose();
    }
  };

  // 4. Handle Live Camera Scan
  const handleCameraScan = (code: string, format: string) => {
    if (code === lastScannedCode) return; // Prevent duplicate rapid trigger
    setLastScannedCode(code);
    setTimeout(() => setLastScannedCode(null), 1500);

    const time = new Date().toLocaleTimeString('pt-BR');

    if (isExpected) {
      const added = addExpectedItemsToBatch(batch.id, [{ barcode: code }]);
      onRefresh();
      if (added > 0) {
        setCameraScanLogs((prev) => [`[${time}] ✅ Procurado Adicionado: ${code}`, ...prev.slice(0, 19)]);
      } else {
        setCameraScanLogs((prev) => [`[${time}] ⚠️ Já Existia no Lote: ${code}`, ...prev.slice(0, 19)]);
      }
    } else {
      const result = processScanItem(batch.id, code, format || 'CAMERA');
      onRefresh();
      if (result.status === 'FOUND') {
        setCameraScanLogs((prev) => [`[${time}] ✅ LOCALIZADO OK: ${code}`, ...prev.slice(0, 19)]);
      } else if (result.status === 'EXTRA') {
        setCameraScanLogs((prev) => [`[${time}] 🚨 SOBRA DE ESTOQUE: ${code}`, ...prev.slice(0, 19)]);
      } else if (result.status === 'DUPLICATE') {
        setCameraScanLogs((prev) => [`[${time}] ⚠️ DUPLICADO: ${code}`, ...prev.slice(0, 19)]);
      } else {
        setCameraScanLogs((prev) => [`[${time}] ➕ COLETADO: ${code}`, ...prev.slice(0, 19)]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isExpected ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">{titleText}</h3>
              <p className="text-[10px] text-[var(--text-dim)] font-medium">Lote: {batch.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-primary)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Tabs Navigation */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-[10px] font-extrabold uppercase shrink-0">
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'manual'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Código / Bip</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'paste'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Copia & Cola</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'csv'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV / Arquivo</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
              activeTab === 'camera'
                ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR / Câmera</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 min-h-0 custom-scrollbar">
          {/* TAB 1: MANUAL SINGLE CODE INPUT */}
          {activeTab === 'manual' && (
            <form onSubmit={handleAddSingle} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                  Código de Barras / Patrimônio *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={singleBarcode}
                    onChange={(e) => setSingleBarcode(e.target.value)}
                    placeholder="Ex: PAT-1001, 789123456..."
                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-xs font-mono font-bold focus:ring-1 focus:ring-sky-500 outline-none text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {isExpected && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                      Descrição (Opcional)
                    </label>
                    <input
                      type="text"
                      value={singleDescription}
                      onChange={(e) => setSingleDescription(e.target.value)}
                      placeholder="Ex: Notebook Dell i7"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none text-[var(--text-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                      Categoria / Setor (Opcional)
                    </label>
                    <input
                      type="text"
                      value={singleCategory}
                      onChange={(e) => setSingleCategory(e.target.value)}
                      placeholder="Ex: TI, Adm..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] text-[10px] text-[var(--text-dim)] space-y-1">
                <span className="font-bold block uppercase text-sky-400">💡 Dica de Leitura</span>
                <p>
                  Você pode usar um leitor óptico USB/Bluetooth ou digitar o código. Se apenas o código for fornecido, a descrição é consultada automaticamente no banco de dados de ativos.
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: COPY & PASTE (COLAGEM DE ITENS) */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                  Colar Lista de Códigos / Patrimônios
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Cole aqui sua lista de itens. Formatos aceitos:&#10;PAT-1001&#10;PAT-1002&#10;PAT-1003, Notebook Lenovo, TI&#10;PAT-1004; Impressora HP; Escritório`}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 text-xs font-mono focus:ring-1 focus:ring-sky-500 outline-none text-[var(--text-primary)] leading-relaxed"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[var(--text-dim)]">
                  {pasteText.split('\n').filter((l) => l.trim()).length} linha(s) detectada(s)
                </span>
                <button
                  type="button"
                  onClick={handleProcessPaste}
                  disabled={!pasteText.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40"
                >
                  Processar e Inserir
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CSV / FILE UPLOAD */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-6 text-center space-y-3 relative hover:border-sky-500 transition-colors bg-[var(--bg-secondary)]">
                <input
                  type="file"
                  accept=".csv,.txt,.json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-[var(--text-dim)] mx-auto" />
                <div className="text-xs">
                  <span className="font-bold text-sky-400">Clique para selecionar arquivo</span> ou arraste aqui
                  <p className="text-[10px] text-[var(--text-dim)] mt-1 font-mono">Suporta .CSV, .TXT (1 código por linha) ou .JSON</p>
                </div>
              </div>

              {fileName && (
                <div className="p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] flex justify-between items-center text-xs">
                  <span className="font-bold truncate max-w-[200px]">{fileName}</span>
                  <span className="text-emerald-400 font-bold">{parsedItems.length} itens extraídos</span>
                </div>
              )}

              {parsedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmFileImport}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                >
                  Confirmar Importação de {parsedItems.length} Itens
                </button>
              )}
            </div>
          )}

          {/* TAB 4: CAMERA / QR CODE SCANNER */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-black h-56 relative flex items-center justify-center">
                <CameraScanner onScan={handleCameraScan} active={true} />
              </div>

              {/* Feed logs */}
              <div className="bg-black/90 p-3 rounded-xl border border-[var(--border-color)] font-mono text-[10px] space-y-1 h-28 overflow-y-auto custom-scrollbar">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                  Log de Leituras da Câmera
                </span>
                {cameraScanLogs.length === 0 ? (
                  <span className="text-slate-600 italic block py-2 text-center">Aproxime um QR Code ou Código de Barras da câmera</span>
                ) : (
                  cameraScanLogs.map((log, i) => (
                    <div key={i} className="text-emerald-400 leading-tight">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-between items-center text-xs font-bold shrink-0">
          <span className="text-[10px] text-[var(--text-dim)] uppercase">
            {isExpected ? 'Inclusão de Carga Esperada' : 'Inclusão de Leituras/Bips'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl transition-all"
          >
            Concluir / Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
