import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  TrendingDown,
  Printer,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Batch } from '../types';
import {
  getExpectedItemsForBatch,
  getScanItemsForBatch,
  getAuditStatsForBatch,
  reconcileBatchAudit,
  exportAuditReportCsv,
  exportBatchBarcodesOnly,
} from '../services/storage';

interface AuditResultsScreenProps {
  batch: Batch;
  onBack: () => void;
  onContinueScanning: () => void;
  onNavigate: (screen: string) => void;
}

export const AuditResultsScreen: React.FC<AuditResultsScreenProps> = ({
  batch,
  onBack,
  onContinueScanning,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'OK' | 'MISSING' | 'EXTRA'>('OK');

  const expected = getExpectedItemsForBatch(batch.id);
  const scans = getScanItemsForBatch(batch.id);
  const stats = getAuditStatsForBatch(batch.id);

  // Filter expected codes found
  const foundItems = expected.filter((e) => e.isFound);
  const missingItems = expected.filter((e) => !e.isFound);

  // Extra scans (Sobras)
  const expectedBarcodes = new Set(expected.map((e) => e.barcode.toLowerCase()));
  const extraScans = scans.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase()));

  // Unique extra list
  const uniqueExtrasMap = new Map<string, typeof extraScans[0]>();
  extraScans.forEach((scan) => {
    const key = scan.barcode.trim().toLowerCase();
    if (!uniqueExtrasMap.has(key)) {
      uniqueExtrasMap.set(key, scan);
    }
  });
  const uniqueExtras = Array.from(uniqueExtrasMap.values());

  const handleReconcile = () => {
    reconcileBatchAudit(batch.id);
    alert('Recálculo completo e conciliação de segurança efetuada com sucesso!');
  };

  const handleExportCsv = () => {
     exportAuditReportCsv(batch);
  };

  const handleExportBarcodesOnly = () => {
    if (activeTab === 'OK') {
      exportBatchBarcodesOnly(batch, 'FOUND');
    } else if (activeTab === 'MISSING') {
      exportBatchBarcodesOnly(batch, 'MISSING');
    } else {
      exportBatchBarcodesOnly(batch, 'SCANS');
    }
  };

  const getFilteredList = () => {
    const query = searchTerm.toLowerCase();

    if (activeTab === 'OK') {
      return foundItems.filter(
        (i) =>
          i.barcode.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query)) ||
          (i.category && i.category.toLowerCase().includes(query))
      );
    }
    if (activeTab === 'MISSING') {
      return missingItems.filter(
        (i) =>
          i.barcode.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query)) ||
          (i.category && i.category.toLowerCase().includes(query))
      );
    }
    return uniqueExtras.filter((i) => i.barcode.toLowerCase().includes(query));
  };

  const displayList = getFilteredList();

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-6 select-none relative pb-10 shadow-xl border-x border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Resultado</h1>
            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-wider block mt-0.5">
              Matriz de Conciliação
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBarcodesOnly}
            className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all shadow-sm flex items-center justify-center"
            title="Exportar Apenas Códigos (.CSV) desta lista"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={handleExportCsv}
            className="p-2.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 active:scale-95 transition-all shadow-sm flex items-center justify-center"
            title="Exportar Relatório CSV Completo"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden space-y-4">
        <div className="px-1 shrink-0">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            AuditResultsScreen.tsx
          </span>
        </div>
        {/* Recalculate Trigger Button */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleReconcile}
            className="flex-1 py-3 bg-[var(--color-blue)]/10 text-[var(--color-blue)] border border-[var(--color-blue)]/20 rounded-2xl text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Verificar e Conciliar Lote</span>
          </button>
        </div>

        {/* Matrix KPI Summary tabs cards */}
        <div className="grid grid-cols-3 gap-2.5 shrink-0">
          {/* TAB OK */}
          <button
            onClick={() => {
              setActiveTab('OK');
              setSearchTerm('');
            }}
            className={`rounded-2xl p-3 flex flex-col justify-between text-left transition-all active:scale-95 shadow-sm min-h-[90px] border ${
              activeTab === 'OK'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)]'
            }`}
          >
            <CheckCircle2 className="w-4.5 h-4.5" />
            <div>
              <span className="text-xl font-extrabold leading-none block">{foundItems.length}</span>
              <span className="text-[10px] font-bold opacity-90 mt-1 block uppercase tracking-wider">OK / Encontrado</span>
            </div>
          </button>

          {/* TAB MISSING */}
          <button
            onClick={() => {
              setActiveTab('MISSING');
              setSearchTerm('');
            }}
            className={`rounded-2xl p-3 flex flex-col justify-between text-left transition-all active:scale-95 shadow-sm min-h-[90px] border ${
              activeTab === 'MISSING'
                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)]'
            }`}
          >
            <AlertTriangle className="w-4.5 h-4.5" />
            <div>
              <span className="text-xl font-extrabold leading-none block">{missingItems.length}</span>
              <span className="text-[10px] font-bold opacity-90 mt-1 block uppercase tracking-wider">Faltantes</span>
            </div>
          </button>

          {/* TAB EXTRA */}
          <button
            onClick={() => {
              setActiveTab('EXTRA');
              setSearchTerm('');
            }}
            className={`rounded-2xl p-3 flex flex-col justify-between text-left transition-all active:scale-95 shadow-sm min-h-[90px] border ${
              activeTab === 'EXTRA'
                ? 'bg-red-500/10 border-red-500 text-red-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-dim)]'
            }`}
          >
            <TrendingDown className="w-4.5 h-4.5" />
            <div>
              <span className="text-xl font-extrabold leading-none block">{uniqueExtras.length}</span>
              <span className="text-[10px] font-bold opacity-90 mt-1 block uppercase tracking-wider">Sobras</span>
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar nos resultados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)]"
          />
        </div>

        {/* Main List view scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar pb-6 min-h-0">
          {displayList.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-dim)] text-xs font-bold uppercase tracking-wider opacity-40">
              Nenhum registro nesta aba.
            </div>
          ) : (
            displayList.map((item, idx) => {
              const isExtra = activeTab === 'EXTRA';
              const isMissing = activeTab === 'MISSING';

              return (
                <div
                  key={isExtra ? (item as any).id : item.id}
                  className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-mono text-sm font-black text-[var(--text-primary)] tracking-tight">
                        {item.barcode}
                      </p>
                      {!isExtra && (item as any).description && (
                        <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">
                          {(item as any).description}
                        </p>
                      )}
                      {isExtra && (
                        <p className="text-xs font-bold text-red-400 mt-1">
                          Código de barras de sobra (Não cadastrado)
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shrink-0 ${
                        isExtra
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : isMissing
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {isExtra ? 'Sobra' : isMissing ? 'Faltante' : 'Auditado'}
                    </span>
                  </div>

                  {!isExtra && (item as any).category && (
                    <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-color)]/60 text-[10px] font-bold text-[var(--text-dim)]">
                      <span className="uppercase tracking-widest">{(item as any).category}</span>
                      <span>{batch.name}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer return buttons */}
      <div className="pt-4 border-t border-[var(--border-color)] shrink-0 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-sm"
        >
          Voltar
        </button>
        <button
          onClick={onContinueScanning}
          className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg"
        >
          Retomar Leitura
        </button>
      </div>
    </div>
  );
};
