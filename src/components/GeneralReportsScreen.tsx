import React from 'react';
import {
  ArrowLeft,
  PieChart,
  BarChart3,
  TrendingUp,
  Award,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Batch } from '../types';
import { getAuditStatsForBatch, getAllAssetRecords } from '../services/storage';

interface GeneralReportsScreenProps {
  batches: Batch[];
  onBack: () => void;
  onOpenBatchDetails?: (batchId: number) => void;
  onNavigateBatchList?: () => void;
}

export const GeneralReportsScreen: React.FC<GeneralReportsScreenProps> = ({
  batches,
  onBack,
  onOpenBatchDetails,
  onNavigateBatchList,
}) => {
  const assets = getAllAssetRecords();

  const totalAssets = assets.length;
  const foundAssets = assets.filter((a) => a.status === 'ENCONTRADO' || a.status === 'COLETADO').length;
  const missingAssets = assets.filter((a) => a.status === 'PENDENTE').length;
  const extraAssets = assets.filter((a) => a.status === 'SOBRA').length;

  const totalProgress = totalAssets > 0 ? Math.round((foundAssets / totalAssets) * 100) : 0;

  // Breakdown by Categories / Sectors
  const categoryStats: { [key: string]: { total: number; found: number } } = {};
  assets.forEach((asset) => {
    const cat = asset.category || 'Outros';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, found: 0 };
    }
    categoryStats[cat].total++;
    if (asset.status === 'ENCONTRADO' || asset.status === 'COLETADO') {
      categoryStats[cat].found++;
    }
  });

  const categories = Object.keys(categoryStats).map((name) => ({
    name,
    total: categoryStats[name].total,
    found: categoryStats[name].found,
    progress: Math.round((categoryStats[name].found / categoryStats[name].total) * 100),
  }));

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
          <h1 className="text-lg font-black uppercase tracking-tight">Relatórios</h1>
          <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-wider block mt-0.5">
            Métricas de Desempenho
          </span>
        </div>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden space-y-6">
        <div className="px-1 shrink-0">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            GeneralReportsScreen.tsx
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar pb-6 min-h-0">
          
          {/* Main Ring/Progress Visual */}
          <div className="card-elevated p-6 flex flex-col items-center justify-center text-center shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-dim)] mb-4">
              Progresso Geral da Empresa
            </span>

            {/* Circular Gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  className="text-gray-200 dark:text-gray-800"
                />
                {/* Foreground Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  strokeWidth="8"
                  stroke="var(--progress-fill)"
                  fill="transparent"
                  strokeDasharray="264"
                  strokeDashoffset={264 - (264 * totalProgress) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-[var(--text-primary)] leading-none">
                  {totalProgress}%
                </span>
                <span className="text-[10px] font-bold text-[var(--text-dim)] mt-1.5 uppercase tracking-wider">
                  Auditado
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-4 border-t border-[var(--border-color)]/60">
              <div className="text-left">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">LOCALIZADOS</span>
                <h4 className="text-lg font-extrabold text-emerald-400 mt-1">{foundAssets} / {totalAssets}</h4>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">PENDENTES</span>
                <h4 className="text-lg font-extrabold text-amber-500 mt-1">{missingAssets}</h4>
              </div>
            </div>
          </div>

          {/* Section: Category metrics list */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
              Desempenho por Setor / Categoria
            </h3>

            {categories.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)] italic px-1">Nenhum setor cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.name}
                    className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-xs font-black uppercase tracking-tight">{cat.name}</h4>
                      <span className="text-[11px] font-black text-blue-400">
                        {cat.found}/{cat.total} ({cat.progress}%)
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(5, cat.progress)}%`,
                          backgroundColor: 'var(--progress-fill)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Overages / Extras audit status card */}
          {extraAssets > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4.5 space-y-1.5 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Sobras de Estoque Críticas
              </span>
              <p className="text-xs font-semibold text-[var(--text-secondary)] leading-relaxed">
                Foram localizados <span className="text-red-400 font-extrabold">{extraAssets} patrimônios de sobra</span> nas auditorias. Estes bens não constavam em nenhuma lista pré-importada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
