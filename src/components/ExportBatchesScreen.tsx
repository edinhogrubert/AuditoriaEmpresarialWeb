import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  Boxes,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Batch, ScanItem } from '../types';
import {
  exportMultipleBatchesToCsv,
  exportMultipleBatchesBarcodesOnly,
  getScanCountForBatch,
} from '../services/storage';

interface ExportBatchesScreenProps {
  batches: Batch[];
  allItems: ScanItem[];
  onBack: () => void;
}

export const ExportBatchesScreen: React.FC<ExportBatchesScreenProps> = ({
  batches,
  allItems,
  onBack,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === batches.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(batches.map((b) => b.id));
    }
  };

  const handleExportCsv = () => {
    if (selectedIds.length === 0) return;
    const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));
    exportMultipleBatchesToCsv(selectedBatches, allItems);
  };

  const handleExportBarcodesOnly = () => {
    if (selectedIds.length === 0) return;
    const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));
    exportMultipleBatchesBarcodesOnly(selectedBatches);
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-6 select-none relative pb-10 shadow-xl border-x border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-6 border-b border-[var(--border-color)] shrink-0">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight">Exportação</h1>
          <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-wider block mt-0.5">
            Gerar Arquivos e Relatórios
          </span>
        </div>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Toggle Select All */}
        {batches.length > 0 && (
          <div className="flex justify-between items-center px-1 shrink-0">
            <button
              onClick={handleSelectAll}
              className="text-xs font-bold text-blue-400 hover:underline"
            >
              {selectedIds.length === batches.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
            <span className="text-[10px] text-[var(--text-dim)] font-bold">
              {selectedIds.length} selecionados
            </span>
          </div>
        )}

        {/* Batches Selection Grid */}
        {batches.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
            <Boxes className="w-12 h-12 mb-3 text-gray-500" />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum lote para exportar</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar pb-6">
            {batches.map((batch) => {
              const isSelected = selectedIds.includes(batch.id);
              const count = getScanCountForBatch(batch.id);

              return (
                <div
                  key={batch.id}
                  onClick={() => handleToggle(batch.id)}
                  className={`card-elevated p-4.5 flex items-center justify-between gap-4 cursor-pointer transition-all hover:border-[var(--text-dim)] shadow-xs ${
                    isSelected ? 'border-[var(--color-blue)] bg-[var(--color-blue)]/5' : 'border-[var(--border-color)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-black uppercase tracking-tight truncate">{batch.name}</h3>
                    <p className="text-[10px] text-[var(--text-dim)] font-bold mt-1 uppercase">
                      {batch.type === 'VERIFICATION' ? 'Auditoria' : 'Coleta'} • {count} itens lidos
                    </p>
                  </div>

                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-[var(--color-blue)] bg-[var(--color-blue)] text-white' : 'border-[var(--border-color)]'}`}>
                    {isSelected && <CheckCircle2 className="w-4.5 h-4.5 fill-current text-white bg-[var(--color-blue)] rounded-full" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action export triggers */}
      <div className="space-y-2.5 mt-2 shrink-0">
        <button
          onClick={handleExportBarcodesOnly}
          disabled={selectedIds.length === 0}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg flex items-center justify-center gap-2"
        >
          <FileText className="w-4.5 h-4.5" />
          <span>Exportar Apenas Códigos (.CSV)</span>
        </button>

        <button
          onClick={handleExportCsv}
          disabled={selectedIds.length === 0}
          className="w-full py-3.5 bg-[var(--bg-secondary)] hover:bg-purple-500/10 text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-sm flex items-center justify-center gap-2"
        >
          <FileSpreadsheet className="w-4.5 h-4.5 text-purple-400" />
          <span>Exportar Planilha Completa (CSV)</span>
        </button>
      </div>
    </div>
  );
};
