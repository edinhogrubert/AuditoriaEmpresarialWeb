import React, { useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Smartphone,
  Eye,
  Trash2,
  Database,
  CloudLightning,
  Sparkles,
  Cloud
} from 'lucide-react';
import { AppSettings } from '../types';
import { getStoredSettings, saveSettings } from '../services/storage';
import { BackupModal } from './BackupModal';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onBack: () => void;
  onResetData: () => void;
  onLoadDemo: () => void;
  isSyncing?: boolean;
  onCloudSync?: () => void;
  lastSyncTime?: string | null;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  onResetData,
  onLoadDemo,
  isSyncing = false,
  onCloudSync,
  lastSyncTime = null,
}) => {
  const [showBackupModal, setShowBackupModal] = useState(false);

  const toggleSound = () => {
    const updated = { ...settings, soundEnabled: !settings.soundEnabled, scanBeep: !settings.scanBeep };
    saveSettings(updated);
    onUpdateSettings(updated);
  };

  const toggleVibration = () => {
    const updated = { ...settings, vibrationEnabled: !settings.vibrationEnabled };
    saveSettings(updated);
    onUpdateSettings(updated);
  };

  const toggleContinuous = () => {
    const updated = { ...settings, continuousScan: !settings.continuousScan };
    saveSettings(updated);
    onUpdateSettings(updated);
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    const updated = { ...settings, theme };
    saveSettings(updated);
    onUpdateSettings(updated);
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
          <h1 className="text-lg font-black uppercase tracking-tight">Ajustes</h1>
          <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-wider block mt-0.5">
            Preferências do Aplicativo
          </span>
        </div>
      </div>

      <div className="py-6 flex-1 flex flex-col overflow-hidden space-y-6">
        <div className="px-1 shrink-0">
          <span className="text-[10px] font-mono font-bold bg-[var(--bg-secondary)] text-[var(--color-blue)] px-2.5 py-1 rounded-md border border-[var(--border-color)] shadow-xs inline-block">
            SettingsScreen.tsx
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar pb-6">
          
          {/* Section: Visual Theme */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
              Aparência / Tema
            </h3>
            <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-1.5 rounded-2xl border border-[var(--border-color)] shadow-sm">
              <button
                onClick={() => handleThemeChange('light')}
                className={`py-3 text-xs font-bold rounded-xl transition-all ${
                  settings.theme === 'light'
                    ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Modo Claro (Polish)
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`py-3 text-xs font-bold rounded-xl transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Modo Escuro (Eye-safe)
              </button>
            </div>
          </div>

          {/* Section: Audio & Feedback */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
              Alertas & Feedback
            </h3>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 divide-y divide-[var(--border-color)]/60 shadow-xs">
              {/* Audio toggle */}
              <div className="flex items-center justify-between py-3 first:pt-0">
                <div className="flex items-center gap-3">
                  {settings.soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
                  <div>
                    <h4 className="text-xs font-bold">Bip de Leitura</h4>
                    <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-medium">Bipar ao ler códigos de barras</p>
                  </div>
                </div>
                <button
                  onClick={toggleSound}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.soundEnabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Vibration Toggle */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold">Feedback de Vibração</h4>
                    <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-medium">Vibrar dispositivo no sucesso</p>
                  </div>
                </div>
                <button
                  onClick={toggleVibration}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.vibrationEnabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.vibrationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Continuous scanning */}
              <div className="flex items-center justify-between py-3 last:pb-0">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <div>
                    <h4 className="text-xs font-bold">Leitura Contínua</h4>
                    <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-medium">Não fechar câmera ao registrar</p>
                  </div>
                </div>
                <button
                  onClick={toggleContinuous}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.continuousScan ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.continuousScan ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Backup Utility */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
              Cópia de Segurança
            </h3>
            <button
              onClick={() => setShowBackupModal(true)}
              className="w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 border border-[var(--border-color)] text-[var(--text-primary)] rounded-2xl p-4.5 flex items-center justify-between transition-all active:scale-[0.99] shadow-xs"
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <h4 className="text-xs font-bold">Importação & Exportação</h4>
                  <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-medium">Backup completo em arquivos offline</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Acessar ›</span>
            </button>
          </div>

          {/* Section: Firebase Sync */}
          {onCloudSync && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
                Sincronização Nuvem (Firebase)
              </h3>
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold">Nuvem Ativa</h4>
                      <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-medium">Firestore Database</p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                    ONLINE
                  </span>
                </div>

                {lastSyncTime && (
                  <p className="text-[9px] text-[var(--text-dim)] font-mono">
                    Último sync: {lastSyncTime}
                  </p>
                )}

                <button
                  onClick={onCloudSync}
                  disabled={isSyncing}
                  className={`w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 ${isSyncing ? 'opacity-55' : ''}`}
                >
                  <CloudLightning className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Maintenance / Actions */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] px-1">
              Desenvolvedor & Manutenção
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onLoadDemo}
                className="py-4 bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center gap-2 shadow-xs"
              >
                <Sparkles className="w-5 h-5" />
                <span>Carregar Demo</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('ATENÇÃO: Isso irá apagar permanentemente todas as auditorias e logs. Continuar?')) {
                    onResetData();
                  }
                }}
                className="py-4 bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex flex-col items-center gap-2 shadow-xs"
              >
                <Trash2 className="w-5 h-5" />
                <span>Limpar Banco</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Modal Overlay Popup */}
      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}
    </div>
  );
};
