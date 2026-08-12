import React, { useState } from 'react';
import {
  ArrowLeft,
  Scan,
  Download,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  TrendingUp,
  Boxes,
  FileCode,
  FileText,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  QrCode,
  FileSpreadsheet,
  X,
  Filter,
  Eye,
  Copy,
  Check,
  Layers,
  AlertCircle
} from 'lucide-react';
import { Batch, ScanItem, ExpectedItem } from '../types';
import {
  getStoredSettings,
  closeBatch,
  reopenBatch,
  getExpectedItemsForBatch,
  getAuditStatsForBatch,
  deleteExpectedItemById,
} from '../services/storage';
import { CloseBatchModal } from './CloseBatchModal';
import { BatchInsertModal } from './BatchInsertModal';
import { ExportModal } from './ExportModal';

interface BatchDetailsScreenProps {
  batch: Batch;
  scanItems: ScanItem[];
  onBack: () => void;
  onDone: () => void;
  onContinueScanning: () => void;
  onImportMore: () => void;
  onViewResults: () => void;
  onViewAuditLog: () => void;
  onRefresh: () => void;
  onDeleteItem: (itemId: number) => void;
}

export type BatchDetailTab = 'ALL' | 'EXPECTED' | 'FOUND' | 'MISSING' | 'EXCESS';

export const BatchDetailsScreen: React.FC<BatchDetailsScreenProps> = ({
  batch,
  scanItems,
  onBack,
  onDone,
  onContinueScanning,
  onImportMore,
  onViewResults,
  onViewAuditLog,
  onRefresh,
  onDeleteItem,
}) => {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [insertModalTarget, setInsertModalTarget] = useState<'EXPECTED' | 'SCANNED' | null>(null);
  const [activeTab, setActiveTab] = useState<BatchDetailTab>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const settings = getStoredSettings();
  const isVerification = batch.type === 'VERIFICATION';

  const expectedItems = getExpectedItemsForBatch(batch.id);
  const expectedCount = expectedItems.length;

  const expectedBarcodesSet = new Set(expectedItems.map((e) => e.barcode.toLowerCase().trim()));
  const extraScans = scanItems.filter(
    (s) => !expectedBarcodesSet.has(s.barcode.toLowerCase().trim())
  );

  const foundExpected = expectedItems.filter((e) => e.isFound);
  const missingExpected = expectedItems.filter((e) => !e.isFound);

  const stats = isVerification ? getAuditStatsForBatch(batch.id) : null;
  const pendingCount = missingExpected.length;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleDeleteExpected = (id: number, barcode: string) => {
    if (confirm(`Deseja apagar o item procurado (${barcode}) deste lote?`)) {
      deleteExpectedItemById(id);
      onRefresh();
    }
  };

  const handleDeleteScan = (id: number, barcode: string) => {
    if (confirm(`Deseja apagar a leitura (${barcode}) deste lote?`)) {
      onDeleteItem(id);
      onRefresh();
    }
  };

  const handleToggleClose = () => {
    if (batch.isClosed) {
      if (confirm('Deseja reabrir este lote para edição?')) {
        reopenBatch(batch.id);
        onRefresh();
      }
    } else {
      setShowCloseModal(true);
    }
  };

  const handleConcludeBatch = (reason: string) => {
    closeBatch(batch.id, reason);
    setShowCloseModal(false);
    onRefresh();
  };

  // Build filtered lists for each tab view
  const query = searchTerm.toLowerCase().trim();

  // 1. ALL items list
  const allUnifiedItems = [
    ...expectedItems.map((e) => ({
      key: `exp-${e.id}`,
      id: e.id,
      barcode: e.barcode,
      description: e.description || 'Ativo Cadastrado',
      category: e.category || 'Geral',
      status: (e.isFound ? 'FOUND' : 'MISSING') as 'FOUND' | 'MISSING' | 'EXCESS',
      timestamp: e.timestampFound,
      type: 'EXPECTED' as const,
    })),
    ...extraScans.map((s) => ({
      key: `scan-${s.id}`,
      id: s.id,
      barcode: s.barcode,
      description: 'Item Excedente (Fora da Carga)',
      category: 'Extra / Sobra',
      status: 'EXCESS' as const,
      timestamp: s.timestamp,
      type: 'SCAN' as const,
    })),
  ].filter(
    (i) =>
      i.barcode.toLowerCase().includes(query) ||
      i.description.toLowerCase().includes(query) ||
      i.category.toLowerCase().includes(query)
  );

  // 2. EXPECTED list
  const filteredExpected = expectedItems.filter(
    (e) =>
      e.barcode.toLowerCase().includes(query) ||
      (e.description && e.description.toLowerCase().includes(query)) ||
      (e.category && e.category.toLowerCase().includes(query))
  );

  // 3. FOUND list (ONLY Expected items that were found)
  const filteredFound = foundExpected
    .map((e) => ({
      key: `exp-${e.id}`,
      id: e.id,
      barcode: e.barcode,
      description: e.description || 'Ativo Cadastrado',
      category: e.category || 'Geral',
      origin: 'Item da Carga' as const,
      timestamp: e.timestampFound,
      type: 'EXPECTED' as const,
    }))
    .filter(
      (i) =>
        i.barcode.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        i.category.toLowerCase().includes(query)
    );

  // 4. MISSING list
  const filteredMissing = missingExpected.filter(
    (e) =>
      e.barcode.toLowerCase().includes(query) ||
      (e.description && e.description.toLowerCase().includes(query)) ||
      (e.category && e.category.toLowerCase().includes(query))
  );

  // 5. EXCESS list
  const filteredExcess = extraScans.filter((s) =>
    s.barcode.toLowerCase().includes(query)
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 text-[var(--text-primary)] bg-[var(--bg-primary)] flex flex-col min-h-full select-none space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border-color)] gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] active:scale-95 transition-all shadow-sm"
            title="Voltar aos Lotes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                {batch.name}
              </h1>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                  batch.isClosed
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}
              >
                {batch.isClosed ? 'Concluído' : 'Ativo / Em Progresso'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)] font-medium mt-0.5">
              {isVerification ? 'Auditoria de Ativos Patrimoniais' : 'Coleta Simples de Campo'} • Criado em{' '}
              {new Date(batch.timestamp).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Export Request Trigger */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm active:scale-95"
            title="Exportar dados (Todos, Procurados, Encontrados, Faltantes ou Excedentes)"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Dados</span>
          </button>

          <button
            onClick={onViewAuditLog}
            className="px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-amber-500/10 border border-[var(--border-color)] hover:border-amber-500/30 text-amber-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            title="Ver Histórico de Auditoria"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Log</span>
          </button>

          <button
            onClick={handleToggleClose}
            className={`px-3 py-2.5 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 ${
              batch.isClosed
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-amber-500/30 hover:text-amber-500'
            }`}
          >
            {batch.isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{batch.isClosed ? 'Reabrir Lote' : 'Encerrar Lote'}</span>
          </button>

          {!batch.isClosed && (
            <button
              onClick={onContinueScanning}
              className="px-4 py-2.5 bg-[#002b59] dark:bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Scan className="w-4 h-4" />
              <span>Escanear</span>
            </button>
          )}
        </div>
      </div>

      {/* Closed Info Badge */}
      {batch.isClosed && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-500 block">
                Lote Encerrado / Auditoria Concluída
              </span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Motivo: {batch.closedReason || 'Encerramento manual'}. Reabra o lote se precisar adicionar mais leituras.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleClose}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all"
          >
            Reabrir para Edição
          </button>
        </div>
      )}

      {/* KPI Stats Tiles (Visually Grouped Containers according to Domain Hierarchy) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* GROUP 1: VISÃO GLOBAL / TOTAL */}
        <div className="md:col-span-3 border border-sky-500/30 bg-sky-500/5 p-3 rounded-2xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Visão Global</span>
            </span>
            <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
              Total
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`p-3 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer h-full ${
              activeTab === 'ALL'
                ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-500/20 shadow-md'
                : 'bg-[var(--bg-primary)]/80 border border-sky-500/20 hover:border-sky-500/50'
            }`}
          >
            <span className="text-[10px] font-black uppercase text-[var(--text-dim)]">
              1. Total no Lote
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <h3 className="text-2xl font-black text-sky-400">
                {expectedCount + extraScans.length}
              </h3>
              <span className="text-[10px] font-bold text-[var(--text-dim)]">itens</span>
            </div>
            <p className="text-[9px] text-[var(--text-dim)] mt-0.5">Consolidado (Carga + Excedentes)</p>
          </button>
        </div>

        {/* GROUP 2: CARGA PREVISTA (PROCURADOS) */}
        <div className="md:col-span-4 border border-amber-500/30 bg-amber-500/5 p-3 rounded-2xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" />
              <span>Carga Prevista (Ativos a Buscar)</span>
            </span>
            <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Procurados: {expectedCount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 h-full">
            {/* Card: Carga Total Prevista */}
            <button
              type="button"
              onClick={() => setActiveTab('EXPECTED')}
              className={`p-3 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer ${
                activeTab === 'EXPECTED'
                  ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/20 shadow-md'
                  : 'bg-[var(--bg-primary)]/80 border border-amber-500/20 hover:border-amber-500/50'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-amber-500">
                2. Carga Total
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <h3 className="text-xl font-black text-amber-500">
                  {expectedCount}
                </h3>
                <span className="text-[10px] font-bold text-amber-500">carga</span>
              </div>
              <p className="text-[9px] text-[var(--text-dim)] mt-0.5">Previsto na lista</p>
            </button>

            {/* Card: Faltantes */}
            <button
              type="button"
              onClick={() => setActiveTab('MISSING')}
              className={`p-3 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer ${
                activeTab === 'MISSING'
                  ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 shadow-md'
                  : 'bg-[var(--bg-primary)]/80 border border-amber-500/20 hover:border-amber-500/50'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-amber-400">
                4. Faltantes
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <h3 className="text-xl font-black text-amber-400">
                  {pendingCount}
                </h3>
                <span className="text-[10px] font-bold text-amber-400">faltas</span>
              </div>
              <p className="text-[9px] text-[var(--text-dim)] mt-0.5">Não localizados</p>
            </button>
          </div>
        </div>

        {/* GROUP 3: LEITURAS DE CAMPO (CAPTURAS / BIPS) */}
        <div className="md:col-span-5 border border-emerald-500/30 bg-emerald-500/5 p-3 rounded-2xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              <span>Leituras de Campo (Bips Efetuados)</span>
            </span>
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Total Bips: {scanItems.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 h-full">
            {/* Card: Encontrados (Localizados da carga) */}
            <button
              type="button"
              onClick={() => setActiveTab('FOUND')}
              className={`p-3 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer ${
                activeTab === 'FOUND'
                  ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/20 shadow-md'
                  : 'bg-[var(--bg-primary)]/80 border border-emerald-500/20 hover:border-emerald-500/50'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-emerald-400">
                3. Encontrados
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <h3 className="text-xl font-black text-emerald-400">
                  {foundExpected.length}
                </h3>
                <span className="text-[10px] font-bold text-emerald-400">ok</span>
              </div>
              <p className="text-[9px] text-[var(--text-dim)] mt-0.5">Da carga inicial</p>
            </button>

            {/* Card: Excedentes / Sobras */}
            <button
              type="button"
              onClick={() => setActiveTab('EXCESS')}
              className={`p-3 rounded-xl text-left flex flex-col justify-between transition-all cursor-pointer ${
                activeTab === 'EXCESS'
                  ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/20 shadow-md'
                  : 'bg-[var(--bg-primary)]/80 border border-rose-500/20 hover:border-rose-500/50'
              }`}
            >
              <span className="text-[10px] font-black uppercase text-rose-400">
                5. Excedentes
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <h3 className="text-xl font-black text-rose-400">
                  {extraScans.length}
                </h3>
                <span className="text-[10px] font-bold text-rose-400">sobras</span>
              </div>
              <p className="text-[9px] text-[var(--text-dim)] mt-0.5">Bipados fora da carga</p>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons & Filter Row (Clear Ingestion Names with Counts) */}
      {!batch.isClosed && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setInsertModalTarget('EXPECTED')}
            className="px-5 py-2.5 rounded-full border-2 border-amber-500/80 hover:border-amber-400 bg-amber-500/10 text-amber-400 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-sm"
            title="Importar ou cadastrar ativos previstos para busca neste lote"
          >
            <PlusCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>+ ATIVOS A BUSCAR ({expectedCount})</span>
          </button>

          <button
            onClick={() => setInsertModalTarget('SCANNED')}
            className="px-5 py-2.5 rounded-full border-2 border-emerald-500/80 hover:border-emerald-400 bg-emerald-500/10 text-emerald-400 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-sm"
            title="Importar ou cadastrar leituras/bips realizados em campo"
          >
            <PlusCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>+ LEITURAS DE CAMPO ({scanItems.length})</span>
          </button>
        </div>
      )}

      {/* Live Filter Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-[var(--text-dim)] absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtrar registros do lote por código, descrição ou categoria..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-9 py-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-3.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Spacious Web Data Table Area */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-3xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[380px]">
        {/* Table Content: TODOS */}
        {activeTab === 'ALL' && (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {allUnifiedItems.length === 0 ? (
              <div className="py-20 text-center opacity-60 space-y-3 px-4">
                <Layers className="w-12 h-12 mx-auto text-[var(--text-dim)]" />
                <h4 className="text-sm font-black uppercase tracking-wider">Nenhum registro encontrado</h4>
                <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                  Use os botões de inserção ou o scanner para cadastrar ativos no lote.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Código / Patrimônio</th>
                    <th className="py-3 px-4">Descrição do Ativo</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-center">Status no Lote</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-medium">
                  {allUnifiedItems.map((item, index) => (
                    <tr key={item.key} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                      <td className="py-3 px-4 text-center text-[var(--text-dim)] font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] tracking-tight">
                            {item.barcode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(item.barcode)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-dim)] hover:text-sky-400 transition-all"
                            title="Copiar código"
                          >
                            {copiedCode === item.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {item.description}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {item.status === 'FOUND' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Encontrado</span>
                          </span>
                        )}
                        {item.status === 'MISSING' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Faltante</span>
                          </span>
                        )}
                        {item.status === 'EXCESS' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border bg-rose-500/10 text-rose-400 border-rose-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Excedente / Sobra</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!batch.isClosed && (
                          <button
                            onClick={() =>
                              item.type === 'EXPECTED'
                                ? handleDeleteExpected(item.id, item.barcode)
                                : handleDeleteScan(item.id, item.barcode)
                            }
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Excluir este item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Table Content: PROCURADOS */}
        {activeTab === 'EXPECTED' && (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {filteredExpected.length === 0 ? (
              <div className="py-20 text-center opacity-60 space-y-3 px-4">
                <Boxes className="w-12 h-12 mx-auto text-[var(--text-dim)]" />
                <h4 className="text-sm font-black uppercase tracking-wider">Nenhum item procurado encontrado</h4>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Código / Patrimônio</th>
                    <th className="py-3 px-4">Descrição do Ativo</th>
                    <th className="py-3 px-4">Categoria / Setor</th>
                    <th className="py-3 px-4 text-center">Status Auditado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-medium">
                  {filteredExpected.map((item, index) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                      <td className="py-3 px-4 text-center text-[var(--text-dim)] font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-[var(--text-primary)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] tracking-tight">
                            {item.barcode}
                          </span>
                          <button
                            onClick={() => handleCopyCode(item.barcode)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-dim)] hover:text-amber-400 transition-all"
                          >
                            {copiedCode === item.barcode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {item.description || 'Ativo sem descrição'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                          {item.category || 'Geral'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border ${
                            item.isFound
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {item.isFound ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Encontrado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Faltante</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!batch.isClosed && (
                          <button
                            onClick={() => handleDeleteExpected(item.id, item.barcode)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Excluir item procurado"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Table Content: ENCONTRADOS */}
        {activeTab === 'FOUND' && (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {filteredFound.length === 0 ? (
              <div className="py-20 text-center opacity-60 space-y-3 px-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-[var(--text-dim)]" />
                <h4 className="text-sm font-black uppercase tracking-wider">Nenhum item encontrado no lote</h4>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Código / Patrimônio</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4 text-center">Data e Hora Leitura</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-medium">
                  {filteredFound.map((item, index) => (
                    <tr key={item.key} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                      <td className="py-3 px-4 text-center text-[var(--text-dim)] font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 tracking-tight">
                          {item.barcode}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {item.description}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                          {item.origin}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center text-[var(--text-secondary)] font-mono text-[11px]">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : '-'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!batch.isClosed && (
                          <button
                            onClick={() =>
                              item.type === 'EXPECTED'
                                ? handleDeleteExpected(item.id, item.barcode)
                                : handleDeleteScan(item.id, item.barcode)
                            }
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Excluir leitura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Table Content: FALTANTES */}
        {activeTab === 'MISSING' && (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {filteredMissing.length === 0 ? (
              <div className="py-20 text-center opacity-60 space-y-3 px-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
                <h4 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                  Nenhum item faltante! Todos os ativos foram localizados!
                </h4>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Código / Patrimônio Faltante</th>
                    <th className="py-3 px-4">Descrição do Ativo</th>
                    <th className="py-3 px-4">Categoria / Setor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-medium">
                  {filteredMissing.map((item, index) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                      <td className="py-3 px-4 text-center text-[var(--text-dim)] font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 tracking-tight">
                          {item.barcode}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {item.description || 'Ativo sem descrição'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] bg-[var(--bg-primary)] px-2.5 py-1 rounded-md border border-[var(--border-color)]">
                          {item.category || 'Geral'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pendente</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!batch.isClosed && (
                          <button
                            onClick={() => handleDeleteExpected(item.id, item.barcode)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Excluir das pendências"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Table Content: EXCEDENTES / SOBRAS */}
        {activeTab === 'EXCESS' && (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {filteredExcess.length === 0 ? (
              <div className="py-20 text-center opacity-60 space-y-3 px-4">
                <Boxes className="w-12 h-12 mx-auto text-[var(--text-dim)]" />
                <h4 className="text-sm font-black uppercase tracking-wider">
                  Nenhum item excedente / sobra registrado
                </h4>
                <p className="text-xs text-[var(--text-dim)] max-w-md mx-auto">
                  Sobras ocorrem quando um código de barras é bipado em campo, mas não constava na carga inicial de procurados.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Código / Patrimônio Excedente</th>
                    <th className="py-3 px-4">Observação</th>
                    <th className="py-3 px-4 text-center">Data e Hora da Leitura</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-medium">
                  {filteredExcess.map((item, index) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-primary)]/60 transition-colors group">
                      <td className="py-3 px-4 text-center text-[var(--text-dim)] font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 tracking-tight">
                          {item.barcode}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[var(--text-dim)] font-semibold">
                        Item bipado não previsto na carga inicial
                      </td>

                      <td className="py-3 px-4 text-center text-[var(--text-secondary)] font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleString('pt-BR')}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border bg-rose-500/10 text-rose-400 border-rose-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Excedente / Sobra</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!batch.isClosed && (
                          <button
                            onClick={() => handleDeleteScan(item.id, item.barcode)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Excluir leitura excedente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Footer Summary Bar */}
        <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-dim)]">
          <span>
            Exibindo a aba{' '}
            <strong className="text-[var(--text-primary)]">
              {activeTab === 'ALL'
                ? `Todos (${allUnifiedItems.length})`
                : activeTab === 'EXPECTED'
                ? `Procurados (${filteredExpected.length})`
                : activeTab === 'FOUND'
                ? `Encontrados (${filteredFound.length})`
                : activeTab === 'MISSING'
                ? `Faltantes (${filteredMissing.length})`
                : `Excedentes (${filteredExcess.length})`}
            </strong>
          </span>
          <button onClick={onDone} className="text-xs font-bold text-sky-400 hover:underline">
            Concluir Edição & Voltar aos Lotes
          </button>
        </div>
      </div>

      {/* Conclude Batch Modal Popup */}
      {showCloseModal && (
        <CloseBatchModal onClose={() => setShowCloseModal(false)} onConfirm={handleConcludeBatch} />
      )}

      {/* Insert Modal Popup */}
      {insertModalTarget && (
        <BatchInsertModal
          batch={batch}
          targetType={insertModalTarget}
          onClose={() => setInsertModalTarget(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Request Export Modal Popup */}
      {showExportModal && (
        <ExportModal batch={batch} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
};
