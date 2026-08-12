import React, { useState } from 'react';
import { ArrowLeft, Package, Plus } from 'lucide-react';

interface NewBatchScreenProps {
  onBack: () => void;
  onCreateBatch: (name: string, description: string) => void;
}

export const NewBatchScreen: React.FC<NewBatchScreenProps> = ({ onBack, onCreateBatch }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do lote.');
      return;
    }
    onCreateBatch(name, description);
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
          <h1 className="text-lg font-black uppercase tracking-tight">Criar Novo Lote</h1>
          <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest mt-0.5 block">
            Coleta de Código de Barras
          </span>
        </div>
      </div>

      {/* Main Content */}
      <form onSubmit={handleSubmit} className="py-6 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          <div className="px-1">
            <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
              NewBatchScreen.tsx
            </span>
          </div>
          {/* Card Icon Header */}
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-[2rem] bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shadow-sm">
              <Package className="w-8 h-8" />
            </div>
            <p className="text-xs text-[var(--text-dim)] font-bold text-center max-w-[250px]">
              Este lote servirá para coletar livremente códigos de barras sem uma lista prévia de comparação.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs font-bold text-red-400">
              {error}
            </div>
          )}

          {/* Form Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                Nome do Lote *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Ex: Inventário T.I. Almoxarifado"
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                Descrição (Opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre a coleta, setor ou responsável..."
                rows={4}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm rounded-xl focus:outline-none focus:border-[var(--text-dim)] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full mt-6 py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Lote e Iniciar</span>
        </button>
      </form>
    </div>
  );
};
