import React from 'react';
import { ArrowLeft, History, Download, Trash2 } from 'lucide-react';
import { Batch } from '../types';
import { getAuditLogsForBatch, exportAuditLogsToCsv } from '../services/storage';

interface AuditLogScreenProps {
  batch: Batch;
  onBack: () => void;
}

export const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ batch, onBack }) => {
  const logs = getAuditLogsForBatch(batch.id);

  const getLogBadge = (type: string) => {
    switch (type) {
      case 'DUPLICATE_BLOCK':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ITEM_REMOVED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'IMPORT_START':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'BATCH_CLOSED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'BATCH_OPENED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'AUDIT_RECONCILED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col max-w-md mx-auto p-6 select-none shadow-xl border-x border-[var(--border-color)]">
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
            <h1 className="text-lg font-black uppercase tracking-tight">Logs do Lote</h1>
            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-wider block mt-0.5">
              Rastreabilidade de Ações
            </span>
          </div>
        </div>

        <button
          onClick={() => exportAuditLogsToCsv(batch)}
          className="p-2.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 active:scale-95 transition-all shadow-sm"
          title="Exportar Logs"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden space-y-4">
        <div className="px-1 shrink-0">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            AuditLogScreen.tsx
          </span>
        </div>
        {/* Logs Feed */}
        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
            <History className="w-12 h-12 mb-3 text-gray-500" />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum evento registrado</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar pb-6">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-2.5 shadow-xs"
              >
                <div className="flex justify-between items-start gap-4">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${getLogBadge(
                      log.type
                    )}`}
                  >
                    {log.type}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>

                <p className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
                  {log.message}
                </p>

                {log.barcode && (
                  <div className="pt-2 border-t border-[var(--border-color)]/60 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">Patrimônio:</span>
                    <span className="font-mono text-[11px] font-black text-blue-400">{log.barcode}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
