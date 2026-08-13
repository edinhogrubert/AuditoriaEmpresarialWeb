import React, { useState, useEffect, useRef } from 'react';
import { Screen, Batch, ScanItem, AppSettings, ExpectedItem } from './types';
import {
  getStoredBatches,
  getStoredScanItems,
  getStoredSettings,
  getStoredExpectedItems,
  getStoredAuditLogs,
  createBatch,
  deleteBatch,
  processScanItem,
  deleteScanItemAndSync,
  seedDemoData,
  addExpectedItemsToBatch,
  getAuditStatsForBatch,
  getAllAssetRecords,
  closeBatch,
  reopenBatch,
  addAuditLog,
  reconcileBatchAudit,
  clearExpectedItemsForBatch,
  clearScanItemsForBatch
} from './services/storage';

import {
  BarChart3,
  Boxes,
  QrCode,
  Sparkles,
  Settings,
  PlusCircle,
  Brain,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
  Clock,
  Radio,
  Trash2,
  Eye,
  Volume2,
  Smartphone,
  ArrowRight,
  Monitor,
  ChevronRight,
  FileText,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Cloud,
  CloudLightning,
  FolderOpen
} from 'lucide-react';

import { syncToCloud, downloadFromCloud, logChangelogToFirebase } from './services/firebase';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

import { MainScreen } from './components/MainScreen';
import { ScanScreen } from './components/ScanScreen';
import { SequentialScanScreen } from './components/SequentialScanScreen';
import { BatchListScreen } from './components/BatchListScreen';
import { AssetsListScreen } from './components/AssetsListScreen';
import { NewBatchScreen } from './components/NewBatchScreen';
import { ImportInventoryScreen } from './components/ImportInventoryScreen';
import { BatchScanScreen } from './components/BatchScanScreen';
import { VerificationScanScreen } from './components/VerificationScanScreen';
import { BatchDetailsScreen } from './components/BatchDetailsScreen';
import { AuditResultsScreen } from './components/AuditResultsScreen';
import { AuditLogScreen } from './components/AuditLogScreen';
import { ExportBatchesScreen } from './components/ExportBatchesScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { GeneralReportsScreen } from './components/GeneralReportsScreen';
import { QrImportScannerScreen } from './components/QrImportScannerScreen';
import { QrGeneratorScreen } from './components/QrGeneratorScreen';

export function App() {
  // Mode selection: 'desktop' (Web Platform) vs 'mobile' (Classic mobile collector layout)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  
  // Desktop navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'batches' | 'reconciliation' | 'data_hub' | 'qr_generator' | 'ai_auditor' | 'settings'>('dashboard');

  // Mobile navigation screen routing
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [qrImportBatchName, setQrImportBatchName] = useState<string>('Conferência QR');
  const [targetBatchId, setTargetBatchId] = useState<number | null>(null);
  const [qrInitialContent, setQrInitialContent] = useState<string | null>(null);
  const [qrGeneratorInitialText, setQrGeneratorInitialText] = useState<string>('2230110\n2230101');
  const [batchListFilter, setBatchListFilter] = useState<'ALL' | 'COLLECTION' | 'VERIFICATION' | 'PENDING' | 'COMPLETED'>('ALL');

  // Core app data state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());

  // Interactive Live Data Connection Ingestion Hub Simulator state
  const [isSimulatingFeed, setIsSimulatingFeed] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>(['[SISTEMA] Banco de canais de dados ativado. Pronto para conexões remotas.']);
  const [connectionSignal, setConnectionSignal] = useState<'IDLE' | 'CONNECTED' | 'RECEIVING'>('IDLE');
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI Auditor screen state
  const [selectedBatchForAI, setSelectedBatchForAI] = useState<number | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [aiProgressMessage, setAiProgressMessage] = useState('');
  const [aiProgressIndex, setAiProgressIndex] = useState(0);

  // Firebase sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleCloudSync = async () => {
    setIsSyncing(true);
    try {
      const localBatches = getStoredBatches();
      const localExpected = getStoredExpectedItems();
      const localScans = getStoredScanItems();
      const localLogs = getStoredAuditLogs();

      await syncToCloud(localBatches, localExpected, localScans, localLogs);

      const cloudData = await downloadFromCloud();

      localStorage.setItem('inventario_batches_v2', JSON.stringify(cloudData.batches));
      localStorage.setItem('inventario_expected_items_v2', JSON.stringify(cloudData.expectedItems));
      localStorage.setItem('inventario_scan_items_v2', JSON.stringify(cloudData.scanItems));
      localStorage.setItem('inventario_audit_logs_v2', JSON.stringify(cloudData.auditLogs));

      refreshData();
      
      setLastSyncTime(new Date().toLocaleTimeString());
      alert('Sincronização com o Firebase concluída com sucesso! Seus dados foram salvos e integrados na nuvem.');
    } catch (err: any) {
      console.error('Falha na sincronização:', err);
      alert('Falha ao sincronizar com o Firebase: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Asset directory filters in Desktop Mode
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetFilterStatus, setAssetFilterStatus] = useState<'ALL' | 'ENCONTRADO' | 'PENDENTE' | 'SOBRA' | 'COLETADO'>('ALL');

  // Batch manager form in Desktop Mode
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDesc, setNewBatchDesc] = useState('');
  const [newBatchType, setNewBatchType] = useState<'COLLECTION' | 'VERIFICATION'>('VERIFICATION');
  const [rawExpectedText, setRawExpectedText] = useState(''); // Textarea format: BARCODE,DESCRIPTION,CATEGORY

  // Reload data from local storage
  const refreshData = () => {
    setBatches(getStoredBatches());
    setScanItems(getStoredScanItems());
    setExpectedItems(getStoredExpectedItems());
  };

  useEffect(() => {
    refreshData();
    // Auto-select first batch for AI if available
    const b = getStoredBatches();
    if (b.length > 0) {
      setSelectedBatchForAI(b[0].id);
    }
    // Register changelog in Firebase (auditoria0)
    logChangelogToFirebase(
      'v1.2',
      'Atualização de Sistema e Sincronização Firestore',
      'Implementado registro automático de changelog no Firestore (projeto auditoria0) conforme diretrizes, e correções de contraste em campos de busca.'
    );
  }, []);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-mode');
    }
  }, [settings.theme]);

  // Loading indicator text loop for Gemini API calls
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingAI) {
      const messages = [
        'Iniciando conexão segura com a API do Gemini...',
        'Compilando dados de plaquetas patrimoniais e ativos coletados...',
        'Cruzando registros contábeis de cargas físicas com leituras de campo...',
        'Calculando riscos de conformidade, obsolescência e passivo fiscal...',
        'Identificando bens ausentes, sobras inesperadas e duplicidades...',
        'Redigindo recomendações executivas e estratégias de facilities...',
        'Formatando laudo de auditoria patrimonial inteligente...'
      ];
      setAiProgressMessage(messages[0]);
      interval = setInterval(() => {
        setAiProgressIndex((prev) => {
          const next = (prev + 1) % messages.length;
          setAiProgressMessage(messages[next]);
          return next;
        });
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isGeneratingAI]);

  // Simulated live connection scanner stream
  const startScannerSimulation = () => {
    if (isSimulatingFeed) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      setIsSimulatingFeed(false);
      setConnectionSignal('IDLE');
      setSimulatedLogs((prev) => [`[SISTEMA] Transmissão interrompida pelo usuário.`, ...prev.slice(0, 49)]);
      return;
    }

    const targetBatch = batches.find((b) => b.type === 'VERIFICATION') || batches[0];
    if (!targetBatch) {
      alert('Por favor, crie ou selecione um lote de inventário/auditoria antes de simular.');
      return;
    }

    setIsSimulatingFeed(true);
    setConnectionSignal('CONNECTED');
    setSimulatedLogs((prev) => [
      `[SISTEMA] Canal de dados pareado com Coletor Portátil ID #${Math.floor(Math.random() * 90000 + 10000)}`,
      `[SISTEMA] Lote selecionado para recepção automática: "${targetBatch.name}"`,
      ...prev.slice(0, 49)
    ]);

    const barcodesToSimulate = [
      'PAT-1001', 'PAT-1002', 'PAT-1003', 'PAT-1004', 'PAT-1005',
      'PAT-7891000123', 'PAT-7891000124', 'PAT-8888', 'PAT-9999', 'PAT-1111'
    ];

    let count = 0;
    simulationTimerRef.current = setInterval(() => {
      setConnectionSignal('RECEIVING');
      const randomCode = barcodesToSimulate[Math.floor(Math.random() * barcodesToSimulate.length)];
      
      // Process scanned item
      const result = processScanItem(targetBatch.id, randomCode, 'QR_CODE');
      refreshData();

      const time = new Date().toLocaleTimeString();
      let logMsg = `[${time}] Bip recebido: ${randomCode} -> `;
      if (result.status === 'FOUND') {
        logMsg += `✅ CONCILIADO (${result.expectedItem?.description || 'Item'})`;
      } else if (result.status === 'DUPLICATE') {
        logMsg += `⚠️ DUPLICADO BLOQUEADO (Ativo já processado neste lote)`;
      } else if (result.status === 'EXTRA') {
        logMsg += `🚨 SOBRA DE ESTOQUE (Ativo físico localizado mas não cadastrado)`;
      } else {
        logMsg += `➕ COLETADO (Modo Coleção Direta)`;
      }

      setSimulatedLogs((prev) => [logMsg, ...prev.slice(0, 49)]);
      setTimeout(() => setConnectionSignal('CONNECTED'), 800);

      count++;
      if (count >= 12) {
        if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        setIsSimulatingFeed(false);
        setConnectionSignal('IDLE');
        setSimulatedLogs((prev) => [`[SISTEMA] Transmissão de lote móvel finalizada com sucesso.`, ...prev.slice(0, 49)]);
      }
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, []);

  // Fetch AI Insights from server using Google GenAI SDK backend
  const handleGenerateAIInsights = async () => {
    if (!selectedBatchForAI) {
      alert('Selecione um lote de auditoria para analisar.');
      return;
    }

    const batch = batches.find((b) => b.id === selectedBatchForAI);
    if (!batch) return;

    setIsGeneratingAI(true);
    setAiReport(null);

    const bScans = scanItems.filter((s) => s.batchId === batch.id);
    const bExpected = expectedItems.filter((e) => e.batchId === batch.id);
    const stats = getAuditStatsForBatch(batch.id);

    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch,
          scanItems: bScans,
          expectedItems: bExpected,
          stats
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor backend.');
      }

      const data = await response.json();
      setAiReport(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar auditoria com Inteligência Artificial. Utilizando motor local de relatórios.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Create batch in Desktop Mode
  const handleCreateBatchDesktop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) {
      alert('O nome do lote é obrigatório.');
      return;
    }

    // Parse textarea items
    const parsedExpected: { barcode: string; description: string; category: string }[] = [];
    if (newBatchType === 'VERIFICATION' && rawExpectedText.trim()) {
      const lines = rawExpectedText.split('\n');
      lines.forEach((line) => {
        if (!line.trim()) return;
        const parts = line.split(',');
        const barcode = parts[0]?.trim();
        const description = parts[1]?.trim() || 'Item Patrimonial';
        const category = parts[2]?.trim() || 'Geral';
        if (barcode) {
          parsedExpected.push({ barcode, description, category });
        }
      });
    }

    const created = createBatch(newBatchName, newBatchDesc, newBatchType, parsedExpected);
    refreshData();
    setSelectedBatchForAI(created.id);
    
    // Reset fields
    setNewBatchName('');
    setNewBatchDesc('');
    setRawExpectedText('');
    
    alert(`Lote "${created.name}" criado com sucesso!`);
    setActiveTab('batches');
  };

  // Import expected items into an existing batch via JSON upload
  const handleFileUpload = (batchId: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let items: any[] = [];
        if (file.name.endsWith('.json')) {
          items = JSON.parse(text);
        } else {
          // simple CSV parser
          const lines = text.split('\n');
          lines.forEach((line) => {
            const parts = line.split(',');
            if (parts[0] && parts[0].trim().toLowerCase() !== 'barcode' && parts[0].trim().toLowerCase() !== 'codigo') {
              items.push({
                barcode: parts[0]?.trim(),
                description: parts[1]?.trim() || 'Item de Inventário',
                category: parts[2]?.trim() || 'Sem Categoria'
              });
            }
          });
        }

        if (items.length > 0) {
          const added = addExpectedItemsToBatch(batchId, items);
          refreshData();
          alert(`Sucesso! ${added} itens esperados importados e anexados ao lote.`);
        } else {
          alert('Nenhum dado válido encontrado no arquivo.');
        }
      } catch (err) {
        alert('Erro ao ler ou analisar o arquivo patrimonial.');
      }
    };
    reader.readAsText(file);
  };

  // Mobile navigation bridging
  const handleCreateCollectionBatch = (name: string, description: string) => {
    const newB = createBatch(name, description, 'COLLECTION');
    refreshData();
    setActiveBatchId(newB.id);
    setCurrentScreen('batch_scan');
  };

  const handleCreateVerificationBatch = (
    name: string,
    description: string,
    expectedItems: { barcode: string; description?: string; category?: string }[]
  ) => {
    const newB = createBatch(name, description, 'VERIFICATION', expectedItems);
    refreshData();
    setActiveBatchId(newB.id);
    setCurrentScreen('batch_details');
  };

  const handleAddExpectedToBatch = (
    batchId: number,
    items: { barcode: string; description?: string; category?: string }[]
  ) => {
    addExpectedItemsToBatch(batchId, items);
    refreshData();
    setActiveBatchId(batchId);
    setCurrentScreen('batch_details');
  };

  const handleDeleteBatch = (id: number) => {
    if (confirm('Deseja excluir permanentemente este lote de auditoria?')) {
      deleteBatch(id);
      refreshData();
      if (activeBatchId === id) setActiveBatchId(null);
    }
  };

  const handleAddScanItem = (barcode: string, format: string) => {
    if (!activeBatchId) return;
    processScanItem(activeBatchId, barcode, format);
    refreshData();
  };

  const handleDeleteScanItem = (itemId: number) => {
    deleteScanItemAndSync(itemId);
    refreshData();
  };

  const handleResetData = () => {
    localStorage.setItem('inventario_batches_v2', '[]');
    localStorage.setItem('inventario_scan_items_v2', '[]');
    localStorage.setItem('inventario_expected_items_v2', '[]');
    localStorage.setItem('inventario_audit_logs_v2', '[]');
    refreshData();
    setAiReport(null);
    setCurrentScreen('menu');
    alert('Banco de dados redefinido com sucesso.');
  };

  const handleLoadDemo = () => {
    seedDemoData();
    refreshData();
    setCurrentScreen('menu');
    const b = getStoredBatches();
    if (b.length > 0) {
      setSelectedBatchForAI(b[0].id);
    }
    alert('Dados fictícios de demonstração carregados com sucesso.');
  };

  const handleOpenBatch = (batch: Batch) => {
    setActiveBatchId(batch.id);
    setCurrentScreen('batch_details');
  };

  const allStoredBatches = getStoredBatches();
  const activeBatch = activeBatchId
    ? batches.find((b) => b.id === activeBatchId) || allStoredBatches.find((b) => b.id === activeBatchId)
    : undefined;

  const activeBatchItems = activeBatchId
    ? scanItems.filter((item) => item.batchId === activeBatchId)
    : [];

  // Desktop level calculations
  const totalAssetsAcrossCompany = getAllAssetRecords();
  const totalExpectedCount = totalAssetsAcrossCompany.filter((a) => a.batchType === 'VERIFICATION' && a.status !== 'SOBRA').length;
  const foundExpectedCount = totalAssetsAcrossCompany.filter((a) => a.status === 'ENCONTRADO').length;
  const missingExpectedCount = totalExpectedCount - foundExpectedCount;
  const extraAssetsCount = totalAssetsAcrossCompany.filter((a) => a.status === 'SOBRA').length;
  const collectionScansCount = totalAssetsAcrossCompany.filter((a) => a.batchType === 'COLLECTION').length;

  const totalAuditProgress = totalExpectedCount > 0 ? Math.round((foundExpectedCount / totalExpectedCount) * 100) : 0;

  // Process data for Recharts Bar Chart: Expected vs Found per Verification batch
  const batchChartData = batches
    .filter((b) => b.type === 'VERIFICATION')
    .map((b) => {
      const stats = getAuditStatsForBatch(b.id);
      return {
        name: b.name.length > 20 ? b.name.substring(0, 18) + '...' : b.name,
        'Ativos Cadastrados': stats.totalExpected,
        'Localizados': stats.foundCount,
        'Ausentes': stats.missingCount,
        'Sobras': stats.extraCount
      };
    });

  // Category breakdown for pie chart or listing
  const categoryStats: { [key: string]: { total: number; found: number } } = {};
  totalAssetsAcrossCompany.forEach((asset) => {
    const cat = asset.category || 'Outros';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, found: 0 };
    }
    categoryStats[cat].total++;
    if (asset.status === 'ENCONTRADO' || asset.status === 'COLETADO') {
      categoryStats[cat].found++;
    }
  });

  const categoryChartData = Object.keys(categoryStats).map((name) => ({
    name,
    value: categoryStats[name].total,
    found: categoryStats[name].found,
    percent: Math.round((categoryStats[name].found / categoryStats[name].total) * 100) || 0
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Scanning activity mapping over hours / temporal chart
  const scanTimelineMap: { [key: string]: number } = {};
  scanItems.forEach((s) => {
    const dateStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    scanTimelineMap[dateStr] = (scanTimelineMap[dateStr] || 0) + 1;
  });
  
  const scanTimelineData = Object.keys(scanTimelineMap).sort().map((time) => ({
    time,
    Leituras: scanTimelineMap[time]
  })).slice(-15); // latest 15 scan times

  // Filtered Assets list for Desktop view
  const filteredAssetsDesktop = totalAssetsAcrossCompany.filter((a) => {
    const matchesSearch =
      a.barcode.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
      a.batchName.toLowerCase().includes(assetSearchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (assetFilterStatus === 'ALL') return true;
    return a.status === assetFilterStatus;
  });

  return (
    <div className="min-h-screen font-['Inter',sans-serif] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors flex flex-col">
      
      {/* Top Banner View Switcher Bar */}
      <div className="bg-slate-900 text-slate-100 px-6 py-2.5 flex justify-between items-center text-xs shrink-0 border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-semibold text-slate-200">PORTAL DE AUDITORIA & INTELIGÊNCIA PATRIMONIAL</span>
          <span className="text-slate-500 text-[10px] font-mono border border-slate-800 px-1.5 py-0.5 rounded">v2.0 Full-Stack</span>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-850 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => { setViewMode('desktop'); refreshData(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all ${viewMode === 'desktop' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>💻 Portal Administrativo (Desktop)</span>
          </button>
          <button
            onClick={() => { setViewMode('mobile'); refreshData(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all ${viewMode === 'mobile' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>📱 Coletor Móvel (Simulador)</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DESKTOP LAYOUT (PORTAL ADMINISTRATIVO)                                 */}
      {/* ===================================================================== */}
      {viewMode === 'desktop' && (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Side Navigation Menu */}
          <aside className="w-64 bg-[#0d1e3a] text-slate-100 flex flex-col justify-between shrink-0 border-r border-slate-800 select-none">
            
            <div className="p-5 space-y-6">
              {/* Logo Brand */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
                <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-extrabold text-sm text-white shadow-md shadow-sky-900/30">
                  <span>EGS</span>
                </div>
                <div>
                  <h1 className="text-sm font-black tracking-wider text-white uppercase">EGS AUDITORIA</h1>
                  <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-widest mt-0.5">EGrubert</span>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="space-y-1">
                <button
                  onClick={() => { setActiveTab('dashboard'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'dashboard' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Insights & Relatórios</span>
                </button>

                <button
                  onClick={() => { setActiveTab('batches'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'batches' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <Boxes className="w-4 h-4 shrink-0" />
                  <span>Lotes de Auditoria</span>
                  <span className="ml-auto bg-slate-800 text-[10px] text-slate-300 font-bold px-2 py-0.5 rounded-full">{batches.length}</span>
                </button>

                <button
                  onClick={() => { setActiveTab('reconciliation'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'reconciliation' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Banco de Ativos</span>
                </button>

                <button
                  onClick={() => { setActiveTab('data_hub'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left relative ${activeTab === 'data_hub' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Conexão & Data Hub</span>
                  {isSimulatingFeed && (
                    <span className="absolute top-3.5 right-4 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab('qr_generator'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'qr_generator' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <QrCode className="w-4 h-4 shrink-0 text-sky-400" />
                  <span>Gerador QR Code</span>
                </button>

                <button
                  onClick={() => { setActiveTab('ai_auditor'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left border border-slate-800/45 ${activeTab === 'ai_auditor' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-indigo-300 hover:text-white hover:bg-slate-850/60'}`}
                >
                  <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Auditor Inteligente IA</span>
                  <span className="ml-auto bg-purple-900/50 text-[9px] text-purple-300 font-extrabold px-2 py-0.5 rounded-full border border-purple-500/30">GEMINI</span>
                </button>

                <button
                  onClick={handleCloudSync}
                  disabled={isSyncing}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left border border-emerald-900/20 ${isSyncing ? 'opacity-60 cursor-not-allowed' : 'text-emerald-400 hover:text-white hover:bg-emerald-950/35'}`}
                >
                  <Cloud className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-pulse text-emerald-300' : ''}`} />
                  <span>Sincronizar Nuvem</span>
                  {lastSyncTime ? (
                    <span className="ml-auto text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/30 px-1.5 py-0.5 rounded">{lastSyncTime}</span>
                  ) : (
                    <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab('settings'); refreshData(); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'settings' ? 'bg-sky-600 text-white shadow-lg shadow-sky-700/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Configurações</span>
                </button>
              </nav>
            </div>

            {/* Quick Live Connection Stats Footer */}
            <div className="p-4 bg-[#0a162b] border-t border-slate-850">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isSimulatingFeed ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <div>
                  <span className="text-[10px] font-bold text-slate-300 block uppercase tracking-wider">RECEPÇÃO MÓVEL</span>
                  <span className="text-[9px] text-slate-500 block font-medium mt-0.5">{isSimulatingFeed ? 'Coletor Remoto Ativo' : 'Canais em escuta'}</span>
                </div>
              </div>
            </div>

          </aside>

          {/* Main Dashboard Widescreen Area */}
          <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* Upper Metric Header row */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-850 dark:text-white tracking-tight">
                  {activeTab === 'dashboard' && 'Insights, Gráficos & Relatórios Executivos'}
                  {activeTab === 'batches' && 'Gerenciador de Lotes e Inventários'}
                  {activeTab === 'reconciliation' && 'Banco de Dados Patrimoniais Conciliados'}
                  {activeTab === 'data_hub' && 'Canal de Ingestão e Conexão de Dados'}
                  {activeTab === 'qr_generator' && 'Gerador e Impressão de QR Codes'}
                  {activeTab === 'ai_auditor' && 'Módulo de Auditoria e Inteligência Artificial'}
                  {activeTab === 'settings' && 'Ajustes e Parâmetros de Segurança'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {activeTab === 'dashboard' && 'Visão analítica integrada para apoio à tomada de decisão e reconciliação patrimonial (Carga Prevista vs Leituras de Campo).'}
                  {activeTab === 'batches' && 'Controle centralizado para abrir, fechar, auditar e apagar lotes de conferência.'}
                  {activeTab === 'reconciliation' && 'Varredura e filtros detalhados de bens físicos, divergências e transferências de setor.'}
                  {activeTab === 'data_hub' && 'Gerenciamento de conexões de coletores móveis e importação de planilhas de ativos.'}
                  {activeTab === 'qr_generator' && 'Gere QR Codes instantâneos colando listas de números para impressão de etiquetas.'}
                  {activeTab === 'ai_auditor' && 'Estudos detalhados, geração de laudos técnicos patrimoniais e detecção de riscos com o Gemini.'}
                  {activeTab === 'settings' && 'Configurações de som de bip, modo de câmera, redefinições completas do banco de dados.'}
                </p>
              </div>

              {/* Quick interactive stats bar */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-sky-500 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
                  PORTAL-ATV-ORIGIN
                </span>
                <button
                  onClick={() => { refreshData(); alert('Banco de dados local recarregado e sincronizado.'); }}
                  className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs"
                  title="Recarregar dados"
                >
                  <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* TAB: DASHBOARD                                                    */}
            {/* ================================================================= */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Executive Decision Support Banner */}
                <div className="bg-gradient-to-r from-sky-600/10 via-indigo-600/10 to-emerald-600/10 border border-sky-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Resumo de Decisão & Divergências</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {missingExpectedCount > 0 ? (
                        <span className="text-amber-500 font-bold">⚠️ Atenção: {missingExpectedCount} ativos da carga não foram localizados (exigem justificativa de ausência). </span>
                      ) : (
                        <span className="text-emerald-500 font-bold">✅ Todos os ativos previstos na carga inicial foram localizados! </span>
                      )}
                      {extraAssetsCount > 0 && (
                        <span className="text-rose-500 font-bold">⚡ Há {extraAssetsCount} sobras físicas encontradas no ambiente sem cadastro prévio.</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTab('batches')}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>Gerenciar Lotes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveTab('ai_auditor')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Gerar Laudo IA</span>
                    </button>
                  </div>
                </div>

                {/* 4 Cards Stats Grid */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Card 1: Progresso de Auditoria */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Conformidade Geral</span>
                      <h3 className="text-2xl font-black text-sky-500">{totalAuditProgress}%</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Reconciliados da lista</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 2: Localizados */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Ativos Localizados</span>
                      <h3 className="text-2xl font-black text-emerald-500">{foundExpectedCount} <span className="text-xs text-slate-400 font-bold">de {totalExpectedCount}</span></h3>
                      <p className="text-[11px] text-slate-500 font-medium">Físicos verificados</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 3: Bens Ausentes */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Bens Ausentes (Ghost)</span>
                      <h3 className="text-2xl font-black text-amber-500">{missingExpectedCount}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Não bipados no cadastro</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 4: Sobras / Extras */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Excedentes / Sobras</span>
                      <h3 className="text-2xl font-black text-rose-500">{extraAssetsCount} <span className="text-[11px] font-semibold text-slate-400 block">e {collectionScansCount} coletas diretas</span></h3>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
                      <Boxes className="w-6 h-6" />
                    </div>
                  </div>
                </section>

                {/* 2-Column charts bento block */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Recharts Expected vs Found Bar chart */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Conciliação Comparativa por Lote</h4>
                        <span className="text-[11px] text-slate-400">Ativos cadastrados vs. Ativos físicos localizados</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-sky-500 border border-sky-500/20 bg-sky-500/5 px-2 py-0.5 rounded">RECHARTS</span>
                    </div>

                    <div className="h-72 w-full pt-4">
                      {batchChartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          Nenhum lote de verificação com ativos cadastrados.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsBarChart data={batchChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415515" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '11px' }} />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            <Bar dataKey="Ativos Cadastrados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Localizados" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Ausentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Sobras" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Circular Gauge & Category completeness */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Acurácia Patrimonial Geral</h4>
                      <span className="text-[11px] text-slate-400">Progresso total ponderado da auditoria física</span>
                    </div>

                    <div className="py-4 flex flex-col items-center justify-center text-center">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" strokeWidth="8" stroke="currentColor" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                          <circle cx="50" cy="50" r="42" strokeWidth="8" stroke="sky-600" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * totalAuditProgress) / 100} strokeLinecap="round" className="transition-all duration-500" />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{totalAuditProgress}%</span>
                          <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest">Reconciliado</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 w-full mt-5 pt-3 border-t border-slate-100 dark:border-slate-850">
                        <div className="text-left">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Previsto</span>
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">{totalExpectedCount} bens</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Faltante</span>
                          <h4 className="text-sm font-bold text-amber-500 mt-0.5">{missingExpectedCount} bens</h4>
                        </div>
                      </div>
                    </div>
                  </div>

                </section>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Bottom Line: Scan timeline area chart */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Histórico de Escaneamento Físico</h4>
                        <span className="text-[11px] text-slate-400">Fluxo temporal de bips de código de barras em campo</span>
                      </div>
                    </div>

                    <div className="h-64 w-full pt-4">
                      {scanTimelineData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                          Aguardando primeiras leituras para plotar linha temporal.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={scanTimelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#33415515" vertical={false} />
                            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '11px' }} />
                            <Area type="monotone" dataKey="Leituras" stroke="#3b82f6" fillOpacity={0.15} fill="url(#colorLeituras)" />
                            <defs>
                              <linearGradient id="colorLeituras" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Category Breakdown list */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Distribuição por Setores</h4>
                      <span className="text-[11px] text-slate-400">Ativos inventariados de acordo com sua categoria contábil</span>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-60 custom-scrollbar space-y-3 pt-3">
                      {categoryChartData.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-8">Nenhuma categoria cadastrada.</p>
                      ) : (
                        categoryChartData.map((cat, i) => (
                          <div key={cat.name} className="space-y-1.5">
                            <div className="flex justify-between items-baseline text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{cat.name}</span>
                              <span className="font-semibold text-sky-500">{cat.found}/{cat.value} ({cat.percent}%)</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${cat.percent}%`,
                                  backgroundColor: COLORS[i % COLORS.length]
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>

              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: BATCHES (GERENCIADOR DE LOTES)                              */}
            {/* ================================================================= */}
            {activeTab === 'batches' && (
              <div className="space-y-6">
                
                {/* 2-Column Section: Left form, Right List Table */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left column: New Batch Form */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-850">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Abrir Novo Lote Patrimonial</h3>
                    </div>

                    <form onSubmit={handleCreateBatchDesktop} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Identificação / Título do Lote</label>
                        <input
                          type="text"
                          required
                          value={newBatchName}
                          onChange={(e) => setNewBatchName(e.target.value)}
                          placeholder="Ex: Auditoria TI Bloco Central"
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Descrição Operacional</label>
                        <input
                          type="text"
                          value={newBatchDesc}
                          onChange={(e) => setNewBatchDesc(e.target.value)}
                          placeholder="Ex: Coleta de notebooks e periféricos do Bloco A"
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Metodologia do Lote</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setNewBatchType('VERIFICATION')}
                            className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${newBatchType === 'VERIFICATION' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                          >
                            Auditoria / Carga
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewBatchType('COLLECTION')}
                            className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${newBatchType === 'COLLECTION' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                          >
                            Coleção Direta
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          {newBatchType === 'VERIFICATION' ? 'Compara leituras com uma lista de carga esperada.' : 'Apenas coleta de códigos de barras sequenciais sem lista prévia.'}
                        </span>
                      </div>

                      {newBatchType === 'VERIFICATION' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Importação Rápida de Ativos (Cópia & Cola)</label>
                          <textarea
                            rows={4}
                            value={rawExpectedText}
                            onChange={(e) => setRawExpectedText(e.target.value)}
                            placeholder="Insira um ativo por linha no formato:&#10;CODIGO,DESCRICAO,CATEGORIA&#10;PAT-9090,Notebook Lenovo,TI&#10;PAT-8080,Projetor Epson,Audiovisual"
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-mono focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white leading-relaxed"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-[#002b59] dark:bg-sky-600 hover:bg-[#002b59]/90 dark:hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all active:scale-[0.98]"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Abrir Lote Patrimonial</span>
                      </button>
                    </form>
                  </div>

                  {/* Right column: Batches List Widescreen table */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs lg:col-span-2 space-y-4">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Lotes de Auditoria Cadastrados</h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setQrImportBatchName('Auditoria Recebida via QR / Tela');
                            setCurrentScreen('qr_import');
                          }}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Importar via QR / JSON</span>
                        </button>
                        <span className="text-[10px] text-slate-400 font-bold">{batches.length} lotes</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3">Lote</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3">Métricas / Progresso</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {batches.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                                Nenhum lote criado. Use o formulário à esquerda para abrir o primeiro lote.
                              </td>
                            </tr>
                          ) : (
                            batches.map((b) => {
                              const stats = getAuditStatsForBatch(b.id);
                              const progress = stats.progressPercent;
                              const isClosed = b.isClosed;

                              return (
                                <tr key={b.id} className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="py-3 px-3 cursor-pointer" onClick={() => handleOpenBatch(b)}>
                                    <h4 className="font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1.5">
                                      {b.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 max-w-xs truncate">{b.description || 'Sem descrição cadastrada'}</p>
                                    <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Criado em {new Date(b.timestamp).toLocaleDateString()}</span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${b.type === 'VERIFICATION' ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300'}`}>
                                      {b.type === 'VERIFICATION' ? 'Auditoria' : 'Coleção'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    {b.type === 'VERIFICATION' ? (
                                      <div className="space-y-1 w-36">
                                        <div className="flex justify-between text-[9px] font-semibold text-slate-400">
                                          <span>Reconciliado</span>
                                          <span>{progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                              width: `${Math.max(5, progress)}%`,
                                              backgroundColor: 'var(--progress-fill)'
                                            }}
                                          />
                                        </div>
                                        <span className="text-[9px] text-slate-500 font-semibold block">{stats.foundCount} OK / {stats.totalExpected} Previstos / {stats.extraCount} Sobras</span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-bold text-indigo-500">{stats.foundCount + stats.extraCount} bips coletados</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${isClosed ? 'bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                                      {isClosed ? 'Encerrado' : 'Aberto'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <div className="flex justify-end items-center gap-1.5">
                                      <button
                                        onClick={() => handleOpenBatch(b)}
                                        className="px-2.5 py-1 text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                                        title="Abrir lote para inserir procurados, encontrados ou editar"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5" />
                                        <span>Trabalhar Dados</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedBatchForAI(b.id);
                                          setActiveTab('ai_auditor');
                                          handleGenerateAIInsights();
                                        }}
                                        className="p-1.5 text-purple-500 hover:bg-purple-500/10 rounded-lg"
                                        title="Auditoria com IA"
                                      >
                                        <Brain className="w-4 h-4" />
                                      </button>
                                      
                                      <button
                                        onClick={() => {
                                          if (b.isClosed) {
                                            reopenBatch(b.id);
                                          } else {
                                            closeBatch(b.id, 'Conferência física concluída via Portal Administrativo.');
                                          }
                                          refreshData();
                                        }}
                                        className={`p-1.5 rounded-lg ${isClosed ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                        title={isClosed ? 'Reabrir Lote' : 'Encerrar/Fechar Lote'}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>

                                      <button
                                        onClick={() => handleDeleteBatch(b.id)}
                                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                                        title="Excluir Lote"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: RECONCILIATION (BANCO DE ATIVOS COMPLETO)                    */}
            {/* ================================================================= */}
            {activeTab === 'reconciliation' && (
              <div className="space-y-6">
                
                {/* Search & Filters row */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
                  
                  {/* Search input bar */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={assetSearchQuery}
                      onChange={(e) => setAssetSearchQuery(e.target.value)}
                      placeholder="Pesquisar por placa, descrição, setor..."
                      className="w-full bg-slate-100 dark:bg-slate-850 border border-slate-300 dark:border-slate-750 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Multi-filter tabs buttons */}
                  <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-750">
                    <button
                      onClick={() => setAssetFilterStatus('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${assetFilterStatus === 'ALL' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Todos ({totalAssetsAcrossCompany.length})
                    </button>
                    <button
                      onClick={() => setAssetFilterStatus('ENCONTRADO')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${assetFilterStatus === 'ENCONTRADO' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Localizados ({totalAssetsAcrossCompany.filter((a) => a.status === 'ENCONTRADO').length})
                    </button>
                    <button
                      onClick={() => setAssetFilterStatus('PENDENTE')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${assetFilterStatus === 'PENDENTE' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Faltantes ({totalAssetsAcrossCompany.filter((a) => a.status === 'PENDENTE').length})
                    </button>
                    <button
                      onClick={() => setAssetFilterStatus('SOBRA')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${assetFilterStatus === 'SOBRA' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Sobras ({totalAssetsAcrossCompany.filter((a) => a.status === 'SOBRA').length})
                    </button>
                    <button
                      onClick={() => setAssetFilterStatus('COLETADO')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${assetFilterStatus === 'COLETADO' ? 'bg-indigo-500 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Coletas ({totalAssetsAcrossCompany.filter((a) => a.status === 'COLETADO').length})
                    </button>
                  </div>
                </div>

                {/* Massive Assets Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/20 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Código / Plaqueta</th>
                          <th className="py-3 px-4">Descrição do Ativo</th>
                          <th className="py-3 px-4">Setor / Categoria</th>
                          <th className="py-3 px-4">Lote Pertencente</th>
                          <th className="py-3 px-4">Estado de Auditoria</th>
                          <th className="py-3 px-4">Registro Cronológico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                        {filteredAssetsDesktop.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                              Nenhum registro patrimonial atende aos filtros atuais de pesquisa.
                            </td>
                          </tr>
                        ) : (
                          filteredAssetsDesktop.map((asset) => {
                            let statusBadge = (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Sem status
                              </span>
                            );

                            if (asset.status === 'ENCONTRADO') {
                              statusBadge = (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  Localizado
                                </span>
                              );
                            } else if (asset.status === 'PENDENTE') {
                              statusBadge = (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                                  Faltante
                                </span>
                              );
                            } else if (asset.status === 'SOBRA') {
                              statusBadge = (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse">
                                  Sobra de Estoque
                                </span>
                              );
                            } else if (asset.status === 'COLETADO') {
                              statusBadge = (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                                  Coleta Direta
                                </span>
                              );
                            }

                            return (
                              <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {asset.barcode}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                  {asset.description}
                                </td>
                                <td className="py-3 px-4 uppercase tracking-wider text-[10px] font-bold text-slate-500">
                                  {asset.category}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-bold text-slate-600 dark:text-slate-400">{asset.batchName}</span>
                                </td>
                                <td className="py-3 px-4">
                                  {statusBadge}
                                </td>
                                <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                                  {asset.timestamp ? (
                                    <span>{new Date(asset.timestamp).toLocaleString()}</span>
                                  ) : (
                                    <span className="italic text-slate-300 dark:text-slate-700">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: DATA HUB & CONEXÃO                                           */}
            {/* ================================================================= */}
            {activeTab === 'data_hub' && (
              <div className="space-y-6">
                
                {/* Ingestion Hub Header Block with Connection status */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 shadow-md">
                  <div className="space-y-2 z-10 text-center md:text-left">
                    <span className="text-[9px] font-black uppercase tracking-widest text-sky-400 bg-sky-950/50 px-2.5 py-1 rounded-md border border-sky-500/20 inline-block">Sincronizador Central de Dispositivos</span>
                    <h3 className="text-lg font-black tracking-tight text-white">Canal de Comunicação com Aplicativo Coletor</h3>
                    <p className="text-xs text-slate-400 max-w-xl font-medium leading-relaxed">
                      Este portal web recebe e trata automaticamente as leituras bipadas em campo pelos operadores utilizando celulares ou coletores. Ao iniciar o monitoramento, os dados são cruzados instantaneamente com a base esperada.
                    </p>
                  </div>

                  {/* Simulator buttons */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 z-10 flex flex-col gap-3 min-w-[240px] shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span>Coletor Simulado</span>
                      <span className={`px-2 py-0.5 rounded font-black uppercase ${isSimulatingFeed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                        {isSimulatingFeed ? 'Simulando...' : 'Desativado'}
                      </span>
                    </div>

                    <button
                      onClick={startScannerSimulation}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase transition-all shadow-md active:scale-95 ${isSimulatingFeed ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                    >
                      {isSimulatingFeed ? 'Parar Simulação de Coleta' : 'Simular Entrada de Coleta'}
                    </button>

                    <p className="text-[9px] text-slate-500 italic leading-relaxed text-center">
                      Simula o biping remoto de plaquetas a cada 4 segundos no lote ativo para testes contínuos.
                    </p>
                  </div>
                </div>

                {/* Left drag-drop upload, right live streams logger terminal */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* CSV/JSON Drag and drop */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Carga de Matriz Patrimonial & Leitura de QR / JSON</h3>
                        <p className="text-[10px] text-slate-400 mt-1">Carregue arquivos CSV/JSON ou leia QR Codes exibidos na tela de outro celular.</p>
                      </div>
                      <button
                        onClick={() => {
                          setQrImportBatchName('Auditoria Recebida via QR / Tela');
                          setCurrentScreen('qr_import');
                        }}
                        className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Ler QR da Tela / .JSON</span>
                      </button>
                    </div>

                    {batches.length === 0 ? (
                      <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-750 rounded-2xl text-center text-xs text-slate-400 italic">
                        Por favor, crie pelo menos um lote na aba "Lotes de Auditoria" antes de carregar arquivos.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Selecione o Lote de Destino</label>
                          <select
                            value={selectedBatchForAI || ''}
                            onChange={(e) => setSelectedBatchForAI(Number(e.target.value))}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white font-bold"
                          >
                            {batches.filter((b) => b.type === 'VERIFICATION').map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 rounded-2xl p-6 text-center transition-colors cursor-pointer relative bg-slate-50/50 dark:bg-slate-900/10">
                          <input
                            type="file"
                            accept=".csv,.json"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && selectedBatchForAI) {
                                handleFileUpload(selectedBatchForAI, file);
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="flex flex-col items-center gap-3">
                            <Upload className="w-10 h-10 text-slate-400" />
                            <div className="text-xs">
                              <span className="font-bold text-sky-500">Clique para selecionar</span> ou arraste o arquivo aqui
                              <p className="text-[9px] text-slate-400 mt-1 font-mono">Suporta .CSV (codigo, descricao, categoria) ou .JSON</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terminal console for logger incoming feeds */}
                  <div className="bg-[#0b132b] text-[#10b981] p-5 rounded-2xl shadow-xs border border-slate-800 font-mono flex flex-col h-80 justify-between">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-[#10b981] rounded-full animate-ping"></span>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#10b981]">LOG DE RECEPÇÃO EM TEMPO REAL</h4>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500">PORT: 3000 / INGESTION-BUS</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar text-[10px] space-y-1.5 py-3 min-h-0">
                      {simulatedLogs.map((log, index) => (
                        <div key={index} className="leading-relaxed whitespace-pre-wrap break-all">{log}</div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-[9px] text-slate-500 shrink-0">
                      <span>Canais ativos: 1/8 pareados</span>
                      <span>Total de leituras de barramento: {scanItems.length}</span>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: QR GENERATOR (GERADOR DE QR CODES)                          */}
            {/* ================================================================= */}
            {activeTab === 'qr_generator' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs max-w-4xl mx-auto">
                <QrGeneratorScreen
                  onBack={() => setActiveTab('dashboard')}
                  initialText={qrGeneratorInitialText}
                  onCreateBatchWithItems={(name, description, items) => {
                    handleCreateVerificationBatch(name, description, items);
                    setActiveTab('batches');
                  }}
                />
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: AI AUDITOR (INTELIGÊNCIA ARTIFICIAL GEMINI)                 */}
            {/* ================================================================= */}
            {activeTab === 'ai_auditor' && (
              <div className="space-y-6">
                
                {/* AI Auditing Selector Bar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
                  <div className="space-y-1 text-center md:text-left">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 justify-center md:justify-start">
                      <Brain className="w-4 h-4 text-purple-400" /> Analista Patrimonial Inteligente (Gemini AI)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Utilize os modelos de raciocínio da Google para encontrar vulnerabilidades tributárias e desvios operacionais.</p>
                  </div>

                  <div className="flex gap-2.5 w-full md:w-auto">
                    <select
                      value={selectedBatchForAI || ''}
                      onChange={(e) => {
                        setSelectedBatchForAI(Number(e.target.value));
                        setAiReport(null);
                      }}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-white font-bold"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleGenerateAIInsights}
                      disabled={isGeneratingAI || batches.length === 0}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGeneratingAI ? 'Analisando...' : 'Estudar com IA'}</span>
                    </button>
                  </div>
                </div>

                {/* AI Progress Loading Indicator */}
                {isGeneratingAI && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                    <div className="w-14 h-14 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin flex items-center justify-center">
                      <Brain className="w-6 h-6 text-violet-500 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Gerando Laudo de Conformidade...</h4>
                      <p className="text-xs text-purple-400 font-mono font-medium max-w-md animate-pulse">{aiProgressMessage}</p>
                    </div>
                  </div>
                )}

                {/* AI Audit Report Result */}
                {aiReport && !isGeneratingAI && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                    
                    {/* Executive Report column (2-span) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-6">
                      
                      {/* Brand and Risk Banner header */}
                      <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-850">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">LAUDO TÉCNICO PATRIMONIAL</span>
                          <h3 className="text-base font-black text-slate-850 dark:text-white mt-1">Inspeção de Integridade por IA</h3>
                          <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">Análise conclusiva sob a regulamentação do controle físico</span>
                        </div>

                        {/* Pulsing Beacon risk rating badge */}
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">RISCO DE NÃO-CONFORMIDADE</span>
                          <div className="flex items-center gap-2 justify-end mt-1">
                            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${aiReport.riskLevel === 'ALTO' ? 'bg-red-500' : aiReport.riskLevel === 'MÉDIO' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-md ${aiReport.riskLevel === 'ALTO' ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' : aiReport.riskLevel === 'MÉDIO' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                              {aiReport.riskLevel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Executive Summary paragraph */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-violet-400" /> RESUMO EXECUTIVO DO AUDITOR
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50/50 dark:bg-slate-850/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                          {aiReport.summary}
                        </p>
                      </div>

                      {/* Anomalies table */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-400" /> ANOMALIAS E DESVIOS CONSTATADOS
                        </h4>
                        
                        {aiReport.anomalies && aiReport.anomalies.length === 0 ? (
                          <div className="p-4 border border-slate-200/50 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400 italic">
                            Nenhuma anomalia crítica registrada pelo auditor.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {aiReport.anomalies?.map((an: any, index: number) => (
                              <div
                                key={index}
                                className={`p-4 rounded-xl border flex gap-3.5 items-start transition-all shadow-xs ${an.severity === 'CRÍTICO' ? 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-300' : an.severity === 'AVISO' ? 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300'}`}
                              >
                                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${an.severity === 'CRÍTICO' ? 'bg-red-100 dark:bg-red-950/40 text-red-500' : an.severity === 'AVISO' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-500' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-500'}`}>
                                  {an.severity === 'CRÍTICO' ? <XCircle className="w-4 h-4" /> : an.severity === 'AVISO' ? <AlertTriangle className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                </div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <h5 className="font-black uppercase tracking-tight text-slate-850 dark:text-slate-100">{an.type}</h5>
                                    {an.barcode !== '-' && (
                                      <span className="font-mono bg-slate-200/50 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-[9px] font-bold">{an.barcode}</span>
                                    )}
                                  </div>
                                  <p className="text-slate-500 dark:text-slate-400 font-semibold">{an.description}</p>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{an.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Actionable recommendations column (1-span) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
                      <div className="pb-3 border-b border-slate-100 dark:border-slate-850">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Recomendações e Plano de Ação</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Próximos passos operacionais sugeridos pelo motor cognitivo.</p>
                      </div>

                      <div className="space-y-4">
                        {aiReport.recommendations?.map((rec: string, index: number) => (
                          <div key={index} className="flex gap-3 items-start text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                            <input
                              type="checkbox"
                              className="w-4.5 h-4.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 outline-none mt-0.5 accent-sky-500"
                            />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-850/80">
                        <button
                          onClick={() => { window.print(); }}
                          className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 border border-slate-300 dark:border-slate-700 py-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span>Imprimir Laudo Completo</span>
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* AI Missing State */}
                {!aiReport && !isGeneratingAI && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-4">
                    <Brain className="w-12 h-12 text-purple-400/80" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Auditoria Cognitiva IA com Gemini</h4>
                      <p className="text-xs text-slate-400 max-w-sm">Selecione um lote e clique em "Estudar com IA" acima para extrair laudos, conformidade fiscal e detectar desvios de ativos contábeis.</p>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ================================================================= */}
            {/* TAB: SETTINGS                                                     */}
            {/* ================================================================= */}
            {activeTab === 'settings' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs max-w-2xl">
                
                <div className="space-y-6">
                  
                  {/* Theme Select */}
                  <div className="space-y-2 pb-5 border-b border-slate-100 dark:border-slate-850">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Visual e Aparência</h4>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => {
                          const updated = { ...settings, theme: 'light' as const };
                          setSettings(updated);
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${settings.theme === 'light' ? 'bg-[#002b59] text-white shadow-sm' : 'text-slate-500'}`}
                      >
                        Modo Claro (Polish)
                      </button>
                      <button
                        onClick={() => {
                          const updated = { ...settings, theme: 'dark' as const };
                          setSettings(updated);
                        }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${settings.theme === 'dark' ? 'bg-[#002b59] dark:bg-sky-600 text-white shadow-sm' : 'text-slate-400'}`}
                      >
                        Modo Escuro (Eye-safe)
                      </button>
                    </div>
                  </div>

                  {/* Firebase Cloud Sync Control card */}
                  <div className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-850">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Sincronização em Nuvem (Firebase)</h4>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/25 rounded-xl space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="text-sm font-bold text-slate-800 dark:text-emerald-300 flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-emerald-500" />
                            <span>Banco de Dados Firestore Conectado</span>
                          </h5>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Sua auditoria patrimonial é totalmente integrada com o Firebase. Sincronize para habilitar consultas compartilhadas e múltiplos coletores em tempo real.
                          </p>
                        </div>
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-850">
                          ATIVADO
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800 font-mono">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-sans font-bold">Projeto ID</span>
                          <span className="text-slate-750 dark:text-slate-300">auditoria0</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-sans font-bold">Último Sync</span>
                          <span className="text-slate-750 dark:text-slate-300">{lastSyncTime || 'Nunca sincronizado'}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCloudSync}
                        disabled={isSyncing}
                        className={`w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-900/10 flex items-center justify-center gap-2 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <CloudLightning className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                        <span>{isSyncing ? 'Sincronizando com Firestore...' : 'Sincronizar Banco Agora'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback sliders */}
                  <div className="space-y-4 pb-5 border-b border-slate-100 dark:border-slate-850">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Alertas de Coleta</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-250 block">Som do Bip</span>
                        <span className="text-[10px] text-slate-400 block font-medium">Bipar alto ao registrar plaqueta física</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.scanBeep}
                        onChange={(e) => {
                          const updated = { ...settings, scanBeep: e.target.checked };
                          setSettings(updated);
                        }}
                        className="w-10 h-5 bg-slate-200 rounded-full cursor-pointer accent-sky-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-250 block">Vibração háptica</span>
                        <span className="text-[10px] text-slate-400 block font-medium">Vibrar no sucesso da conciliação</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.vibrationEnabled}
                        onChange={(e) => {
                          const updated = { ...settings, vibrationEnabled: e.target.checked };
                          setSettings(updated);
                        }}
                        className="w-10 h-5 bg-slate-200 rounded-full cursor-pointer accent-sky-500"
                      />
                    </div>
                  </div>

                  {/* Purges Database actions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Ações de Desenvolvimento e Limpeza</h4>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleLoadDemo}
                        className="px-4 py-3 bg-sky-500/10 hover:bg-sky-500/25 text-sky-500 dark:text-sky-400 border border-sky-500/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>Carregar Dados Demonstrativos</span>
                      </button>

                      <button
                        onClick={handleResetData}
                        className="px-4 py-3 bg-red-500/10 hover:bg-red-500/25 text-red-500 dark:text-red-400 border border-red-500/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Apagar Tudo (Limpar Banco)</span>
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </main>

        </div>
      )}

      {/* Desktop Modal Workspace for batch details & sub-screens */}
      {viewMode === 'desktop' && currentScreen !== 'menu' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-3xl bg-[var(--bg-primary)] shadow-2xl border border-[var(--border-color)] relative flex flex-col">
            {currentScreen === 'batch_details' && activeBatch && (
              <BatchDetailsScreen
                batch={activeBatch}
                scanItems={activeBatchItems}
                onBack={() => {
                  setCurrentScreen('menu');
                  setActiveBatchId(null);
                }}
                onDone={() => {
                  setCurrentScreen('menu');
                  setActiveBatchId(null);
                }}
                onContinueScanning={() => {
                  setCurrentScreen('batch_scan');
                  setViewMode('mobile');
                }}
                onImportMore={() => {
                  setTargetBatchId(activeBatch.id);
                  setCurrentScreen('import_inventory');
                }}
                onViewResults={() => setCurrentScreen('audit_results')}
                onViewAuditLog={() => setCurrentScreen('audit_log')}
                onRefresh={refreshData}
                onDeleteItem={handleDeleteScanItem}
              />
            )}

            {currentScreen === 'audit_results' && activeBatch && (
              <AuditResultsScreen
                batch={activeBatch}
                onBack={() => setCurrentScreen('batch_details')}
                onContinueScanning={() => {
                  setCurrentScreen('verification_scan');
                  setViewMode('mobile');
                }}
                onNavigate={(s) => setCurrentScreen(s as Screen)}
              />
            )}

            {currentScreen === 'audit_log' && activeBatch && (
              <AuditLogScreen
                batch={activeBatch}
                onBack={() => setCurrentScreen('batch_details')}
              />
            )}

            {currentScreen === 'import_inventory' && (
              <ImportInventoryScreen
                onBack={() => {
                  if (targetBatchId) setCurrentScreen('batch_details');
                  else setCurrentScreen('menu');
                }}
                onCreateVerificationBatch={handleCreateVerificationBatch}
                onAddExpectedToBatch={handleAddExpectedToBatch}
                onNavigateQrImport={(batchName, targetId, initialContent) => {
                  setQrImportBatchName(batchName);
                  setTargetBatchId(targetId || null);
                  setQrInitialContent(initialContent || null);
                  setCurrentScreen('qr_import');
                }}
                onNavigate={(s) => setCurrentScreen(s as Screen)}
                onOpenBatchDetails={(batchId) => {
                  setActiveBatchId(batchId);
                  setCurrentScreen('batch_details');
                }}
                onOpenQrGenerator={(initialText) => {
                  if (initialText) setQrGeneratorInitialText(initialText);
                  setCurrentScreen('qr_generator');
                }}
                targetBatchId={targetBatchId}
                settings={settings}
              />
            )}

            {currentScreen === 'qr_import' && (
              <QrImportScannerScreen
                batchName={qrImportBatchName}
                onBack={() => {
                  setQrInitialContent(null);
                  setCurrentScreen('import_inventory');
                }}
                onImported={(batchId) => {
                  setQrInitialContent(null);
                  refreshData();
                  setActiveBatchId(batchId);
                  setCurrentScreen('batch_details');
                }}
                onAddExpectedToBatch={handleAddExpectedToBatch}
                targetBatchId={targetBatchId || undefined}
                settings={settings}
                initialContent={qrInitialContent || undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MOBILE SIMULATOR VIEW MODE                                            */}
      {/* ===================================================================== */}
      {viewMode === 'mobile' && (
        <div className="flex-1 bg-slate-900 flex items-center justify-center p-4">
          
          {/* Outer Mobile Frame container */}
          <div className="w-[380px] h-[720px] bg-black rounded-[40px] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-black w-32 h-6 rounded-b-2xl z-50 flex justify-center items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800"></span>
            </div>

            {/* Inner Mobile Canvas */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-[var(--bg-primary)] overflow-x-hidden relative">
              
              {currentScreen === 'menu' && (
                <MainScreen
                  onNavigate={(screen, filter) => {
                    if (filter) {
                      setBatchListFilter(filter as any);
                    } else {
                      setBatchListFilter('ALL');
                    }
                    setCurrentScreen(screen as Screen);
                  }}
                  onOpenBatchDetails={(batchId) => {
                    setActiveBatchId(batchId);
                    setCurrentScreen('batch_details');
                  }}
                />
              )}

              {currentScreen === 'scan' && (
                <ScanScreen onBack={() => setCurrentScreen('menu')} />
              )}

              {currentScreen === 'sequential_scan' && (
                <SequentialScanScreen onBack={() => setCurrentScreen('menu')} />
              )}

              {currentScreen === 'batch_list' && (
                <BatchListScreen
                  batches={batches}
                  initialFilter={batchListFilter}
                  hideQuickActions={batchListFilter === 'PENDING' || batchListFilter === 'COMPLETED'}
                  onBack={() => setCurrentScreen('menu')}
                  onNewBatchClick={() => setCurrentScreen('new_batch')}
                  onImportInventoryClick={() => {
                    setTargetBatchId(null);
                    setCurrentScreen('import_inventory');
                  }}
                  onBatchClick={handleOpenBatch}
                  onDeleteBatch={handleDeleteBatch}
                  onExportClick={() => setCurrentScreen('export_batches')}
                />
              )}

              {currentScreen === 'general_reports' && (
                <GeneralReportsScreen
                  batches={batches}
                  onBack={() => setCurrentScreen('menu')}
                  onOpenBatchDetails={(batchId) => {
                    setActiveBatchId(batchId);
                    setCurrentScreen('batch_details');
                  }}
                  onNavigateBatchList={() => setCurrentScreen('batch_list')}
                />
              )}

              {currentScreen === 'assets_list' && (
                <AssetsListScreen
                  onBack={() => setCurrentScreen('menu')}
                  onOpenBatchDetails={(batchId) => {
                    setActiveBatchId(batchId);
                    setCurrentScreen('batch_details');
                  }}
                />
              )}

              {currentScreen === 'new_batch' && (
                <NewBatchScreen
                  onBack={() => setCurrentScreen('batch_list')}
                  onCreateBatch={handleCreateCollectionBatch}
                />
              )}

              {currentScreen === 'import_inventory' && (
                <ImportInventoryScreen
                  onBack={() => {
                    if (targetBatchId) setCurrentScreen('batch_details');
                    else setCurrentScreen('batch_list');
                  }}
                  onCreateVerificationBatch={handleCreateVerificationBatch}
                  onAddExpectedToBatch={handleAddExpectedToBatch}
                  onNavigateQrImport={(batchName, targetId, initialContent) => {
                    setQrImportBatchName(batchName);
                    setTargetBatchId(targetId || null);
                    setQrInitialContent(initialContent || null);
                    setCurrentScreen('qr_import');
                  }}
                  onNavigate={(screen) => setCurrentScreen(screen as Screen)}
                  onOpenBatchDetails={(batchId) => {
                    setActiveBatchId(batchId);
                    setCurrentScreen('audit_results');
                  }}
                  onOpenQrGenerator={(initialText) => {
                    if (initialText) setQrGeneratorInitialText(initialText);
                    setCurrentScreen('qr_generator');
                  }}
                  targetBatchId={targetBatchId}
                  settings={settings}
                />
              )}

              {currentScreen === 'qr_generator' && (
                <QrGeneratorScreen
                  onBack={() => setCurrentScreen('menu')}
                  initialText={qrGeneratorInitialText}
                  onCreateBatchWithItems={(name, description, items) => {
                    handleCreateVerificationBatch(name, description, items);
                    setCurrentScreen('batch_list');
                  }}
                />
              )}

              {currentScreen === 'qr_import' && (
                <QrImportScannerScreen
                  batchName={qrImportBatchName}
                  onBack={() => {
                    setQrInitialContent(null);
                    setCurrentScreen('import_inventory');
                  }}
                  onImported={(batchId) => {
                    setQrInitialContent(null);
                    refreshData();
                    setActiveBatchId(batchId);
                    setCurrentScreen('batch_details');
                  }}
                  onAddExpectedToBatch={handleAddExpectedToBatch}
                  targetBatchId={targetBatchId || undefined}
                  settings={settings}
                  initialContent={qrInitialContent || undefined}
                />
              )}

              {currentScreen === 'batch_scan' && activeBatch && (
                <BatchScanScreen
                  batch={activeBatch}
                  scanItems={activeBatchItems}
                  onBack={() => setCurrentScreen('batch_list')}
                  onAddScanItem={handleAddScanItem}
                  onViewDetails={() => setCurrentScreen('batch_details')}
                />
              )}

              {currentScreen === 'verification_scan' && activeBatch && (
                <VerificationScanScreen
                  batch={activeBatch}
                  onBack={() => setCurrentScreen('batch_list')}
                  onViewAuditResults={() => setCurrentScreen('audit_results')}
                />
              )}

              {currentScreen === 'batch_details' && activeBatch && (
                <BatchDetailsScreen
                  batch={activeBatch}
                  scanItems={activeBatchItems}
                  onBack={() => setCurrentScreen('batch_list')}
                  onDone={() => setCurrentScreen('batch_list')}
                  onContinueScanning={() => {
                    if (activeBatch.type === 'VERIFICATION') {
                       setCurrentScreen('verification_scan');
                    } else {
                       setCurrentScreen('batch_scan');
                    }
                  }}
                  onImportMore={() => {
                    setTargetBatchId(activeBatch.id);
                    setCurrentScreen('import_inventory');
                  }}
                  onViewResults={() => setCurrentScreen('audit_results')}
                  onViewAuditLog={() => setCurrentScreen('audit_log')}
                  onRefresh={refreshData}
                  onDeleteItem={handleDeleteScanItem}
                />
              )}

              {currentScreen === 'audit_log' && activeBatch && (
                <AuditLogScreen
                  batch={activeBatch}
                  onBack={() => setCurrentScreen('batch_details')}
                />
              )}

              {currentScreen === 'audit_results' && activeBatch && (
                <AuditResultsScreen
                  batch={activeBatch}
                  onBack={() => setCurrentScreen('batch_details')}
                  onContinueScanning={() => setCurrentScreen('verification_scan')}
                  onNavigate={(screen) => setCurrentScreen(screen as Screen)}
                />
              )}

              {currentScreen === 'export_batches' && (
                <ExportBatchesScreen
                  batches={batches}
                  allItems={scanItems}
                  onBack={() => setCurrentScreen('batch_list')}
                />
              )}

              {currentScreen === 'settings' && (
                <SettingsScreen
                  settings={settings}
                  onUpdateSettings={(s) => setSettings(s)}
                  onBack={() => setCurrentScreen('menu')}
                  onResetData={handleResetData}
                  onLoadDemo={handleLoadDemo}
                  isSyncing={isSyncing}
                  onCloudSync={handleCloudSync}
                  lastSyncTime={lastSyncTime}
                />
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default App;

