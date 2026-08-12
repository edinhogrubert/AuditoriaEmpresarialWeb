import React, { useState } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  Boxes,
  Clock,
  AlertTriangle,
  Layers,
  Check
} from 'lucide-react';
import { Batch, ExpectedItem, ScanItem } from '../types';
import {
  getExpectedItemsForBatch,
  getScanItemsForBatch,
  formatDateStr,
  formatTimeStr,
  downloadCsv,
} from '../services/storage';

interface ExportModalProps {
  batch: Batch;
  onClose: () => void;
}

export type ExportDataset = 'ALL' | 'EXPECTED' | 'FOUND' | 'MISSING' | 'EXCESS';
export type ExportFormat = 'CSV_REPORT' | 'BARCODES_ONLY' | 'JSON';

export const ExportModal: React.FC<ExportModalProps> = ({ batch, onClose }) => {
  const [dataset, setDataset] = useState<ExportDataset>('ALL');
  const [format, setFormat] = useState<ExportFormat>('CSV_REPORT');

  const expected = getExpectedItemsForBatch(batch.id);
  const scans = getScanItemsForBatch(batch.id);

  const expectedBarcodes = new Set(expected.map((e) => e.barcode.toLowerCase().trim()));
  const extraScans = scans.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase().trim()));

  const foundExpected = expected.filter((e) => e.isFound);
  const missingExpected = expected.filter((e) => !e.isFound);

  // Counts for UI options
  const counts = {
    ALL: expected.length + extraScans.length,
    EXPECTED: expected.length,
    FOUND: foundExpected.length,
    MISSING: missingExpected.length,
    EXCESS: extraScans.length,
  };

  const handleExecuteExport = () => {
    const timestampStr = new Date().toISOString().slice(0, 10);
    const sanitizedBatchName = batch.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const baseFilename = `${sanitizedBatchName}_${dataset.toLowerCase()}_${timestampStr}`;

    // Helper to get export items
    let exportItems: Array<{
      status: string;
      barcode: string;
      description: string;
      category: string;
      timestamp?: number | string;
    }> = [];

    // 1. ALL
    if (dataset === 'ALL') {
      expected.forEach((item) => {
        exportItems.push({
          status: item.isFound ? 'ENCONTRADO' : 'FALTANTE',
          barcode: item.barcode,
          description: item.description || 'Ativo Cadastrado',
          category: item.category || 'Geral',
          timestamp: item.timestampFound,
        });
      });
      extraScans.forEach((scan) => {
        exportItems.push({
          status: 'EXCEDENTE / SOBRA',
          barcode: scan.barcode,
          description: 'Sobra de Estoque (Não Previsto)',
          category: 'Extra / Fora de Carga',
          timestamp: scan.timestamp,
        });
      });
    }
    // 2. EXPECTED
    else if (dataset === 'EXPECTED') {
      expected.forEach((item) => {
        exportItems.push({
          status: item.isFound ? 'ENCONTRADO' : 'FALTANTE',
          barcode: item.barcode,
          description: item.description || 'Ativo Cadastrado',
          category: item.category || 'Geral',
          timestamp: item.timestampFound,
        });
      });
    }
    // 3. FOUND (Only expected items that were found)
    else if (dataset === 'FOUND') {
      foundExpected.forEach((item) => {
        exportItems.push({
          status: 'ENCONTRADO',
          barcode: item.barcode,
          description: item.description || 'Ativo Cadastrado',
          category: item.category || 'Geral',
          timestamp: item.timestampFound,
        });
      });
    }
    // 4. MISSING
    else if (dataset === 'MISSING') {
      missingExpected.forEach((item) => {
        exportItems.push({
          status: 'FALTANTE',
          barcode: item.barcode,
          description: item.description || 'Ativo Cadastrado',
          category: item.category || 'Geral',
        });
      });
    }
    // 5. EXCESS
    else if (dataset === 'EXCESS') {
      extraScans.forEach((scan) => {
        exportItems.push({
          status: 'EXCEDENTE / SOBRA',
          barcode: scan.barcode,
          description: 'Sobra de Estoque (Não Previsto)',
          category: 'Extra / Fora de Carga',
          timestamp: scan.timestamp,
        });
      });
    }

    // EXPORT IMPLEMENTATION
    if (format === 'CSV_REPORT') {
      let csvContent = 'Status,Código/Patrimônio,Descrição,Categoria,Data e Hora de Leitura\n';
      exportItems.forEach((row) => {
        const status = row.status;
        const code = `"${row.barcode.replace(/"/g, '""')}"`;
        const desc = `"${row.description.replace(/"/g, '""')}"`;
        const cat = `"${row.category.replace(/"/g, '""')}"`;
        const time = row.timestamp
          ? typeof row.timestamp === 'number'
            ? `${formatDateStr(row.timestamp)} ${formatTimeStr(row.timestamp)}`
            : row.timestamp
          : '-';
        csvContent += `${status},${code},${desc},${cat},${time}\n`;
      });

      downloadCsv(csvContent, `relatorio_${baseFilename}.csv`);
    } else if (format === 'BARCODES_ONLY') {
      const uniqueCodes = Array.from(new Set(exportItems.map((i) => i.barcode.trim())));
      const csvContent = uniqueCodes.map((code) => `${code},`).join('\n');
      downloadCsv(csvContent, `codigos_${baseFilename}.csv`);
    } else if (format === 'JSON') {
      const payload = {
        batch,
        exportFilter: dataset,
        totalRecords: exportItems.length,
        exportedAt: new Date().toISOString(),
        items: exportItems,
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${baseFilename}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl relative flex flex-col space-y-6 text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Exportar Dados do Lote</h2>
              <p className="text-xs text-[var(--text-dim)] font-medium">
                {batch.name} • Escolha o conjunto de dados e o formato do arquivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dataset Selection */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-wider text-[var(--text-dim)] block">
            1. Selecione quais dados deseja exportar:
          </label>

          <div className="grid grid-cols-1 gap-2">
            {/* ALL */}
            <button
              type="button"
              onClick={() => setDataset('ALL')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                dataset === 'ALL'
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400 ring-2 ring-sky-500/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-sky-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-sky-400" />
                <div>
                  <span className="text-xs font-bold block">Todos os Registros (Consolidado)</span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Procurados, encontrados, faltantes e excedentes combinados
                  </span>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {counts.ALL} itens
              </span>
            </button>

            {/* EXPECTED */}
            <button
              type="button"
              onClick={() => setDataset('EXPECTED')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                dataset === 'EXPECTED'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-2 ring-amber-500/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Boxes className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-xs font-bold block">Apenas Procurados (Carga Inicial)</span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Todos os itens previstos na carga de inventário
                  </span>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {counts.EXPECTED} itens
              </span>
            </button>

            {/* FOUND */}
            <button
              type="button"
              onClick={() => setDataset('FOUND')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                dataset === 'FOUND'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-emerald-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="text-xs font-bold block">Apenas Encontrados / Localizados</span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Itens cuja leitura foi confirmada em campo
                  </span>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {counts.FOUND} itens
              </span>
            </button>

            {/* MISSING */}
            <button
              type="button"
              onClick={() => setDataset('MISSING')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                dataset === 'MISSING'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-2 ring-amber-500/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-xs font-bold block">Apenas Faltantes / Pendentes</span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Itens da carga inicial que ainda não foram encontrados
                  </span>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {counts.MISSING} itens
              </span>
            </button>

            {/* EXCESS */}
            <button
              type="button"
              onClick={() => setDataset('EXCESS')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                dataset === 'EXCESS'
                  ? 'bg-rose-500/10 border-rose-500 text-rose-400 ring-2 ring-rose-500/30'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-rose-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <div>
                  <span className="text-xs font-bold block">Apenas Excedentes / Sobras</span>
                  <span className="text-[10px] text-[var(--text-dim)]">
                    Itens bipados que não constavam na lista inicial de procurados
                  </span>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                {counts.EXCESS} itens
              </span>
            </button>
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-wider text-[var(--text-dim)] block">
            2. Escolha o formato de saída:
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormat('CSV_REPORT')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                format === 'CSV_REPORT'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-400 font-bold'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-purple-500/30'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-purple-400" />
              <span className="text-[11px] leading-tight">Relatório CSV Completo</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('BARCODES_ONLY')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                format === 'BARCODES_ONLY'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-emerald-500/30'
              }`}
            >
              <FileText className="w-5 h-5 text-emerald-400" />
              <span className="text-[11px] leading-tight">Apenas Códigos (.CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormat('JSON')}
              className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                format === 'JSON'
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-bold'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-sky-500/30'
              }`}
            >
              <FileCode className="w-5 h-5 text-sky-400" />
              <span className="text-[11px] leading-tight">Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-dim)] hover:bg-[var(--bg-secondary)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Arquivo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
