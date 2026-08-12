import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface CloseBatchModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const CloseBatchModal: React.FC<CloseBatchModalProps> = ({ onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason.trim() || 'Concluído manualmente');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-50">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2.5rem] w-full max-w-sm p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]/60">
          <div className="flex items-center gap-2 text-amber-500">
            <Lock className="w-5 h-5" />
            <h3 className="text-sm font-black uppercase tracking-wider">Encerrar Lote</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-dim)] hover:bg-[var(--bg-primary)] rounded-full transition-all"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] leading-relaxed">
            Ao encerrar este lote, nenhuma leitura ou exclusão adicional será permitida até que ele seja reaberto.
          </p>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">
              Justificativa / Observação
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Auditoria concluída 100% OK, sem divergências no Bloco A."
              rows={3}
              className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs rounded-xl focus:outline-none focus:border-[var(--text-dim)] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-xs font-bold active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-md"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
