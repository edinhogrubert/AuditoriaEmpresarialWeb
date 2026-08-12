import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Boxes,
  Printer,
  Sparkles,
} from 'lucide-react';
import { getAllAssetRecords, AssetRecord } from '../services/storage';

interface AssetsListScreenProps {
  onBack: () => void;
  onOpenBatchDetails?: (batchId: number) => void;
}

export const AssetsListScreen: React.FC<AssetsListScreenProps> = ({
  onBack,
  onOpenBatchDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ENCONTRADO' | 'PENDENTE' | 'SOBRA' | 'COLETADO'>('ALL');
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);

  const assets = getAllAssetRecords();

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || asset.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handlePrintTag = (asset: AssetRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta - ${asset.barcode}</title>
          <style>
            @page { size: 80mm 50mm; margin: 0; }
            body {
              font-family: Arial, sans-serif;
              padding: 10px;
              text-align: center;
              box-sizing: border-box;
              margin: 0;
            }
            .title { font-size: 11px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
            .subtitle { font-size: 8px; color: #555; margin-bottom: 6px; }
            .barcode-box {
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 3px;
              border: 1px dashed #333;
              padding: 8px;
              margin-bottom: 5px;
              font-family: 'Courier New', Courier, monospace;
              background-color: #f9f9f9;
            }
            .desc { font-size: 10px; font-weight: bold; margin-top: 3px; margin-bottom: 2px; }
            .cat { font-size: 8px; font-style: italic; color: #666; }
            .footer { font-size: 7px; color: #777; margin-top: 5px; border-top: 1px solid #ccc; padding-top: 3px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="title">Patrimônio Geral</div>
          <div class="subtitle">Controle de Ativos Fixos</div>
          <div class="barcode-box">${asset.barcode}</div>
          <div class="desc">${asset.description}</div>
          <div class="cat">Categoria: ${asset.category}</div>
          <div class="footer">Impresso via Inventário & Auditoria</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status: AssetRecord['status']) => {
    switch (status) {
      case 'ENCONTRADO':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
            Auditado OK
          </span>
        );
      case 'PENDENTE':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">
            Pendente
          </span>
        );
      case 'SOBRA':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-red-500/10 text-red-400 rounded-md border border-red-500/20">
            Sobra de Estoque
          </span>
        );
      case 'COLETADO':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
            Coletado
          </span>
        );
      default:
        return null;
    }
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
          <h1 className="text-lg font-black uppercase tracking-tight">Lista de Bens</h1>
          <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest mt-0.5 block">
            {assets.length} Ativos Cadastrados
          </span>
        </div>
      </div>

      <div className="py-6 space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className="px-1">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            AssetsListScreen.tsx
          </span>
        </div>
        {/* Search & Filter Row */}
        <div className="space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder="Buscar por código, descrição ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'PENDENTE', label: 'Pendentes' },
                { id: 'ENCONTRADO', label: 'Auditados' },
                { id: 'SOBRA', label: 'Sobras' },
              ] as const
            ).map((status) => (
              <button
                key={status.id}
                onClick={() => setFilterStatus(status.id)}
                className={`flex-1 min-w-[70px] py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap px-2.5 ${
                  filterStatus === status.id
                    ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Container */}
        {filteredAssets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 shrink-0">
            <Boxes className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Nenhum Bem Encontrado</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar pb-10">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className="card-elevated p-4 flex flex-col gap-3 hover:border-gray-600 cursor-pointer shadow-sm transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-black text-[var(--text-primary)] tracking-tight">
                      {asset.barcode}
                    </p>
                    <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">
                      {asset.description}
                    </p>
                  </div>
                  {getStatusBadge(asset.status)}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[var(--border-color)]/60 text-[10px] font-semibold text-[var(--text-dim)]">
                  <span className="uppercase tracking-widest">{asset.category}</span>
                  <span className="truncate max-w-[150px]">{asset.batchName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Overlay Sheet */}
      {selectedAsset && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full mx-auto mb-5"></div>

          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                {selectedAsset.category}
              </span>
              <h2 className="text-xl font-mono font-black text-[var(--text-primary)] tracking-tight mt-2.5 break-all">
                {selectedAsset.barcode}
              </h2>
            </div>
            <button
              onClick={() => handlePrintTag(selectedAsset)}
              className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 active:scale-95 transition-all"
              title="Imprimir Etiqueta"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 py-2">
            <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                Descrição do Patrimônio
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)] mt-1">
                {selectedAsset.description}
              </p>
            </div>

            <div className="bg-[var(--bg-primary)] p-4 rounded-2xl border border-[var(--border-color)]">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-dim)] block">
                Vínculo com Arquivo/Lote
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)] mt-1">
                {selectedAsset.batchName}
              </p>
              <button
                onClick={() => {
                  if (onOpenBatchDetails) {
                    onOpenBatchDetails(selectedAsset.batchId);
                  }
                }}
                className="text-[10px] text-blue-400 font-bold hover:underline mt-2 inline-block"
              >
                Abrir Detalhes do Lote
              </button>
            </div>
          </div>

          <button
            onClick={() => setSelectedAsset(null)}
            className="w-full mt-6 py-3.5 bg-[var(--border-color)] hover:bg-[var(--text-dim)]/20 text-[var(--text-primary)] rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
          >
            Fechar Painel
          </button>
        </div>
      )}
    </div>
  );
};
