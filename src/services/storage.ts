import { Batch, ExpectedItem, ScanItem, AppSettings, BatchType, AuditLog, AuditLogType } from '../types';

const BATCHES_KEY = 'inventario_batches_v2';
const SCAN_ITEMS_KEY = 'inventario_scan_items_v2';
const EXPECTED_ITEMS_KEY = 'inventario_expected_items_v2';
const SETTINGS_KEY = 'inventario_settings_v2';
const AUDIT_LOGS_KEY = 'inventario_audit_logs_v2';

export const getStoredAuditLogs = (): AuditLog[] => {
  try {
    const data = localStorage.getItem(AUDIT_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveAuditLogs = (logs: AuditLog[]) => {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {}
};

export const addAuditLog = (batchId: number, type: AuditLogType, barcode?: string, message: string = '') => {
  const logs = getStoredAuditLogs();
  const newLog: AuditLog = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    batchId,
    timestamp: Date.now(),
    type,
    barcode,
    message,
  };
  saveAuditLogs([newLog, ...logs]);
};

export const getAuditLogsForBatch = (batchId: number): AuditLog[] => {
  return getStoredAuditLogs().filter(log => log.batchId === batchId);
};

export const exportAuditLogsToCsv = (batch: Batch) => {
  const logs = getAuditLogsForBatch(batch.id);
  let csvContent = 'Data,Hora,Evento,Patrimônio,Mensagem\n';
  logs.forEach(log => {
    const date = formatDateStr(log.timestamp);
    const time = formatTimeStr(log.timestamp);
    const barcode = log.barcode || '-';
    csvContent += `${date},${time},${log.type},"${barcode}","${log.message.replace(/"/g, '""')}"\n`;
  });
  downloadCsv(csvContent, `log_auditoria_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

// Add Scanned / Collected Items directly to an existing Batch
export const addScannedItemsToBatch = (
  batchId: number,
  items: { barcode: string; format?: string }[]
): number => {
  let addedCount = 0;
  items.forEach((item) => {
    if (item.barcode && item.barcode.trim().length > 0) {
      processScanItem(batchId, item.barcode.trim(), item.format || 'MANUAL');
      addedCount++;
    }
  });

  addAuditLog(batchId, 'IMPORT_START', undefined, `Importados ${addedCount} itens como LEITURA/COLETA de campo.`);
  return addedCount;
};

// Add Expected Items to an existing Batch
export const addExpectedItemsToBatch = (
  batchId: number,
  items: { barcode: string; description?: string; category?: string }[]
) => {
  const allExpected = getStoredExpectedItems();
  const existingForBatch = allExpected.filter(e => e.batchId === batchId);
  const existingBarcodes = new Set(existingForBatch.map(e => e.barcode.toLowerCase()));

  // Lookup in asset database for descriptions if not provided
  const assetRecords = getAllAssetRecords();
  const assetMap = new Map<string, { description: string; category: string }>();
  assetRecords.forEach(a => {
    if (a.barcode && !assetMap.has(a.barcode.toLowerCase())) {
      assetMap.set(a.barcode.toLowerCase(), { description: a.description, category: a.category });
    }
  });

  const newExpected: ExpectedItem[] = [];
  items.forEach((item, index) => {
    const code = item.barcode.trim();
    if (code && !existingBarcodes.has(code.toLowerCase())) {
      const dbMatch = assetMap.get(code.toLowerCase());
      const finalDesc = item.description && item.description !== 'Item de Inventário' && item.description !== 'Lido da Tela'
        ? item.description.trim()
        : dbMatch?.description || `Ativo ${code}`;

      const finalCat = item.category && item.category !== 'Sem Categoria' && item.category !== 'QR Tela'
        ? item.category.trim()
        : dbMatch?.category || 'Geral';

      newExpected.push({
        id: Date.now() + index + Math.floor(Math.random() * 10000),
        batchId: batchId,
        barcode: code,
        description: finalDesc,
        category: finalCat,
        isFound: false,
      });
      existingBarcodes.add(code.toLowerCase());
    }
  });

  if (newExpected.length > 0) {
    saveExpectedItems([...allExpected, ...newExpected]);
  }
  return newExpected.length;
};

// Clear all expected items for a batch
export const clearExpectedItemsForBatch = (batchId: number) => {
  const allExpected = getStoredExpectedItems();
  saveExpectedItems(allExpected.filter(e => e.batchId !== batchId));
};

// Clear all scanned items for a batch
export const clearScanItemsForBatch = (batchId: number) => {
  const allScans = getStoredScanItems();
  saveScanItems(allScans.filter(s => s.batchId !== batchId));

  // Also reset 'isFound' status for all expected items in this batch
  const allExpected = getStoredExpectedItems();
  const updatedExpected = allExpected.map(exp => {
    if (exp.batchId === batchId) {
      return { ...exp, isFound: false, timestampFound: undefined };
    }
    return exp;
  });
  saveExpectedItems(updatedExpected);
};

// Seed initial demo data for demonstration
const SEED_BATCHES: Batch[] = [
  {
    id: 1,
    name: 'Inventário Geral de TI',
    description: 'Coleta de ativos e periféricos',
    type: 'COLLECTION',
    timestamp: Date.now() - 86400000 * 3,
  },
  {
    id: 2,
    name: 'Conferência Patrimonial - Bloco A',
    description: 'Auditoria de bens do setor administrativo',
    type: 'VERIFICATION',
    timestamp: Date.now() - 86400000 * 1,
  },
];

const SEED_SCAN_ITEMS: ScanItem[] = [
  {
    id: 101,
    batchId: 1,
    barcode: 'PAT-7891000123',
    format: 'CODE 128',
    timestamp: Date.now() - 86400000 * 3 + 3600000,
  },
  {
    id: 102,
    batchId: 1,
    barcode: 'PAT-7891000124',
    format: 'CODE 128',
    timestamp: Date.now() - 86400000 * 3 + 7200000,
  },
  {
    id: 201,
    batchId: 2,
    barcode: 'PAT-1001',
    format: 'CODE 128',
    timestamp: Date.now() - 3600000 * 4,
  },
  {
    id: 202,
    batchId: 2,
    barcode: 'PAT-1002',
    format: 'CODE 128',
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: 203,
    batchId: 2,
    barcode: 'PAT-9999', // Extra / Sobra
    format: 'CODE 128',
    timestamp: Date.now() - 3600000 * 1,
  },
];

const SEED_EXPECTED_ITEMS: ExpectedItem[] = [
  {
    id: 301,
    batchId: 2,
    barcode: 'PAT-1001',
    description: 'Notebook Dell Latitude 5420',
    category: 'TI',
    isFound: true,
    timestampFound: Date.now() - 3600000 * 4,
  },
  {
    id: 302,
    batchId: 2,
    barcode: 'PAT-1002',
    description: 'Monitor LG 29 UltraWide',
    category: 'TI',
    isFound: true,
    timestampFound: Date.now() - 3600000 * 2,
  },
  {
    id: 303,
    batchId: 2,
    barcode: 'PAT-1003',
    description: 'Cadeira Ergonômica Flexform',
    category: 'Mobiliário',
    isFound: false,
  },
  {
    id: 304,
    batchId: 2,
    barcode: 'PAT-1004',
    description: 'Nobreak SMS 1200VA',
    category: 'TI',
    isFound: false,
  },
  {
    id: 305,
    batchId: 2,
    barcode: 'PAT-1005',
    description: 'Projetor Epson PowerLite',
    category: 'Audiovisual',
    isFound: false,
  },
];

// Batches API
export const seedDemoData = () => {
  localStorage.setItem(BATCHES_KEY, JSON.stringify(SEED_BATCHES));
  localStorage.setItem(SCAN_ITEMS_KEY, JSON.stringify(SEED_SCAN_ITEMS));
  localStorage.setItem(EXPECTED_ITEMS_KEY, JSON.stringify(SEED_EXPECTED_ITEMS));
};

export const getStoredBatches = (): Batch[] => {
  try {
    const data = localStorage.getItem(BATCHES_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get batches', e);
    return [];
  }
};

export const saveBatches = (batches: Batch[]) => {
  try {
    localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  } catch (e) {
    console.error('Failed to save batches', e);
  }
};

// Scan Items API
export const getStoredScanItems = (): ScanItem[] => {
  try {
    const data = localStorage.getItem(SCAN_ITEMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get scan items', e);
    return [];
  }
};

export const saveScanItems = (items: ScanItem[]) => {
  try {
    localStorage.setItem(SCAN_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save scan items', e);
  }
};

// Expected Items API (Conferência / Auditoria)
export const getStoredExpectedItems = (): ExpectedItem[] => {
  try {
    const data = localStorage.getItem(EXPECTED_ITEMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get expected items', e);
    return [];
  }
};

export const saveExpectedItems = (items: ExpectedItem[]) => {
  try {
    localStorage.setItem(EXPECTED_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save expected items', e);
  }
};

// Create Batch
export const createBatch = (
  name: string,
  description: string = '',
  type: BatchType = 'COLLECTION',
  expectedList: { barcode: string; description?: string; category?: string }[] = []
): Batch => {
  const batches = getStoredBatches();
  const newBatch: Batch = {
    id: Date.now(),
    name: name.trim(),
    description: description.trim(),
    type,
    timestamp: Date.now(),
  };
  saveBatches([newBatch, ...batches]);

  addAuditLog(newBatch.id, 'IMPORT_START', undefined, `Lote criado (${type}). ${expectedList.length > 0 ? `Importados ${expectedList.length} itens.` : ''}`);

  if (type === 'VERIFICATION' && expectedList.length > 0) {
    const allExpected = getStoredExpectedItems();
    const newExpected: ExpectedItem[] = expectedList.map((item, index) => ({
      id: Date.now() + index + Math.floor(Math.random() * 1000),
      batchId: newBatch.id,
      barcode: item.barcode.trim(),
      description: item.description?.trim() || '',
      category: item.category?.trim() || '',
      isFound: false,
    }));
    saveExpectedItems([...allExpected, ...newExpected]);
  }

  return newBatch;
};

// Delete Batch
export const deleteBatch = (batchId: number) => {
  saveBatches(getStoredBatches().filter((b) => b.id !== batchId));
  saveScanItems(getStoredScanItems().filter((i) => i.batchId !== batchId));
  saveExpectedItems(getStoredExpectedItems().filter((e) => e.batchId !== batchId));
};

// Process Scan Item for Verification or Collection Batch
export interface VerificationScanResult {
  status: 'FOUND' | 'DUPLICATE' | 'EXTRA' | 'ADDED';
  message: string;
  item: ScanItem;
  expectedItem?: ExpectedItem;
}

export const processScanItem = (
  batchId: number,
  barcode: string,
  format: string
): VerificationScanResult => {
  const code = barcode.trim();
  const batches = getStoredBatches();
  const batch = batches.find((b) => b.id === batchId);

  const scanItems = getStoredScanItems();
  const alreadyScanned = scanItems.some(
    (i) => i.batchId === batchId && i.barcode.toLowerCase() === code.toLowerCase()
  );

  const newScanItem: ScanItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    batchId,
    barcode: code,
    format: format.toUpperCase(),
    timestamp: Date.now(),
  };

  // If simple collection batch
  if (!batch || batch.type === 'COLLECTION') {
    if (alreadyScanned) {
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de leitura duplicada bloqueada (coleção)');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Este item já foi lido/coletado neste lote!',
        item: newScanItem,
      };
    }
    saveScanItems([newScanItem, ...scanItems]);
    return {
      status: 'ADDED',
      message: 'Item adicionado ao lote',
      item: newScanItem,
    };
  }

  // If Verification / Audit batch
  const expectedItems = getStoredExpectedItems();
  const matchedExpected = expectedItems.find(
    (exp) => exp.batchId === batchId && exp.barcode.toLowerCase() === code.toLowerCase()
  );

  if (matchedExpected) {
    if (matchedExpected.isFound || alreadyScanned) {
      // Already found / scanned previously
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de verificação duplicada bloqueada');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Item já havia sido verificado anteriormente!',
        item: newScanItem,
        expectedItem: matchedExpected,
      };
    } else {
      // First time found!
      const updatedExpected = expectedItems.map((exp) =>
        exp.id === matchedExpected.id
          ? { ...exp, isFound: true, timestampFound: Date.now() }
          : exp
      );
      saveExpectedItems(updatedExpected);
      saveScanItems([newScanItem, ...scanItems]);
      return {
        status: 'FOUND',
        message: 'Sucesso: Patrimônio localizado na lista de auditoria!',
        item: newScanItem,
        expectedItem: { ...matchedExpected, isFound: true, timestampFound: Date.now() },
      };
    }
  } else {
    // Extra item / Sobra de estoque
    if (alreadyScanned) {
      addAuditLog(batchId, 'DUPLICATE_BLOCK', code, 'Tentativa de leitura duplicada de sobra bloqueada');
      return {
        status: 'DUPLICATE',
        message: 'Atenção: Esta sobra de estoque já foi lida anteriormente!',
        item: newScanItem,
      };
    }
    saveScanItems([newScanItem, ...scanItems]);
    return {
      status: 'EXTRA',
      message: 'Aviso: Código escaneado não consta na lista esperada (Sobra)',
      item: newScanItem,
    };
  }
};

// Delete Scan Item & Sync Audit status
export const deleteScanItemAndSync = (itemId: number) => {
  const scanItems = getStoredScanItems();
  const itemToDelete = scanItems.find((i) => i.id === itemId);
  if (!itemToDelete) return;

  addAuditLog(itemToDelete.batchId, 'ITEM_REMOVED', itemToDelete.barcode, 'Item excluído do registro/lote');

  const updatedScanItems = scanItems.filter((i) => i.id !== itemId);
  saveScanItems(updatedScanItems);

  // Check if there are other scans for this same barcode in the same batch
  const remainingSameBarcodeScans = updatedScanItems.filter(
    (i) => i.batchId === itemToDelete.batchId && i.barcode === itemToDelete.barcode
  );

  // If no remaining scans for this code, mark expected item back to unfound
  if (remainingSameBarcodeScans.length === 0) {
    const expectedItems = getStoredExpectedItems();
    const updatedExpected = expectedItems.map((exp) => {
      if (exp.batchId === itemToDelete.batchId && exp.barcode.toLowerCase() === itemToDelete.barcode.toLowerCase()) {
        return { ...exp, isFound: false, timestampFound: undefined };
      }
      return exp;
    });
    saveExpectedItems(updatedExpected);
  }
};

// Delete individual Expected Item by ID
export const deleteExpectedItemById = (expectedItemId: number) => {
  const allExpected = getStoredExpectedItems();
  const item = allExpected.find((e) => e.id === expectedItemId);
  if (!item) return;

  addAuditLog(item.batchId, 'ITEM_REMOVED', item.barcode, 'Item procurado/esperado excluído do lote');
  const updatedExpected = allExpected.filter((e) => e.id !== expectedItemId);
  saveExpectedItems(updatedExpected);
};

// Delete any item (ExpectedItem, ScanItem, or both) from a batch
export const deleteItemFromBatch = (
  batchId: number,
  barcode: string,
  scanId?: number,
  expectedItemId?: number
) => {
  // 1. Remove scan items
  const scanItems = getStoredScanItems();
  const updatedScans = scanItems.filter((s) => {
    if (scanId) return s.id !== scanId;
    return !(s.batchId === batchId && s.barcode.toLowerCase() === barcode.toLowerCase());
  });
  saveScanItems(updatedScans);

  // 2. Remove expected items
  const expectedItems = getStoredExpectedItems();
  const updatedExpected = expectedItems.filter((e) => {
    if (expectedItemId) return e.id !== expectedItemId;
    return !(e.batchId === batchId && e.barcode.toLowerCase() === barcode.toLowerCase());
  });
  saveExpectedItems(updatedExpected);
};

// Helpers & Statistics
export const getScanItemsForBatch = (batchId: number): ScanItem[] => {
  return getStoredScanItems().filter((item) => item.batchId === batchId);
};

export const getScanCountForBatch = (batchId: number): number => {
  return getScanItemsForBatch(batchId).length;
};

export const getExpectedItemsForBatch = (batchId: number): ExpectedItem[] => {
  return getStoredExpectedItems().filter((item) => item.batchId === batchId);
};

export interface AuditStats {
  totalExpected: number;
  foundCount: number;
  missingCount: number;
  extraCount: number;
  progressPercent: number;
}

export const reconcileBatchAudit = (batchId: number): AuditStats => {
  const expectedItems = getStoredExpectedItems();
  const scanItems = getScanItemsForBatch(batchId);
  const scannedBarcodesMap = new Map<string, number>();

  scanItems.forEach((scan) => {
    const key = scan.barcode.trim().toLowerCase();
    if (!scannedBarcodesMap.has(key) || scan.timestamp < scannedBarcodesMap.get(key)!) {
      scannedBarcodesMap.set(key, scan.timestamp);
    }
  });

  let hasExpectedForBatch = false;
  const updatedExpected = expectedItems.map((exp) => {
    if (exp.batchId === batchId) {
      hasExpectedForBatch = true;
      const key = exp.barcode.trim().toLowerCase();
      const matchTimestamp = scannedBarcodesMap.get(key);
      if (matchTimestamp !== undefined) {
        return { ...exp, isFound: true, timestampFound: matchTimestamp };
      } else {
        return { ...exp, isFound: false, timestampFound: undefined };
      }
    }
    return exp;
  });

  saveExpectedItems(updatedExpected);

  // If batch has expected items, ensure batch type is 'VERIFICATION'
  if (hasExpectedForBatch) {
    const batches = getStoredBatches();
    const updatedBatches = batches.map((b) =>
      b.id === batchId && b.type !== 'VERIFICATION' ? { ...b, type: 'VERIFICATION' as const } : b
    );
    localStorage.setItem(BATCHES_KEY, JSON.stringify(updatedBatches));
  }

  addAuditLog(
    batchId,
    'AUDIT_RECONCILED',
    '',
    'Recálculo e conciliação completa da lógica do negócio (TODOS, OK, FALTANTE, EXTRA)'
  );

  return getAuditStatsForBatch(batchId);
};

export const getAuditStatsForBatch = (batchId: number): AuditStats => {
  const expected = getExpectedItemsForBatch(batchId);
  const scans = getScanItemsForBatch(batchId);

  const totalExpected = expected.length;
  const foundCount = expected.filter((e) => e.isFound).length;
  const missingCount = totalExpected - foundCount;

  // Extra items are scans that don't match any expected barcode
  const expectedBarcodes = new Set(expected.map((e) => e.barcode.toLowerCase()));
  const extraScans = scans.filter((s) => !expectedBarcodes.has(s.barcode.toLowerCase()));
  // Unique extra barcodes
  const extraCount = new Set(extraScans.map((s) => s.barcode.toLowerCase())).size;

  const progressPercent = totalExpected > 0 ? Math.round((foundCount / totalExpected) * 100) : 0;

  return {
    totalExpected,
    foundCount,
    missingCount,
    extraCount,
    progressPercent,
  };
};

// Data retrieval for suggestions
export const getUniqueCategories = (): string[] => {
  const items = getStoredExpectedItems();
  const cats = items.map(i => i.category).filter((c): c is string => !!c && c.trim().length > 0);
  return Array.from(new Set(cats)).sort();
};

export const getUniqueDescriptions = (): string[] => {
  const items = getStoredExpectedItems();
  const descs = items.map(i => i.description).filter((d): d is string => !!d && d.trim().length > 0);
  return Array.from(new Set(descs)).sort();
};

// CSV Export Helpers
export const formatDateStr = (timestamp: number): string => {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatTimeStr = (timestamp: number): string => {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

export const exportSingleBatchToCsv = (batch: Batch, items: ScanItem[]) => {
  let csvContent = 'Index,Tipo,Conteúdo,Data,Hora\n';
  items.forEach((item, index) => {
    const date = formatDateStr(item.timestamp);
    const time = formatTimeStr(item.timestamp);
    const escapedBarcode = item.barcode.includes(',') ? `"${item.barcode}"` : item.barcode;
    csvContent += `${index + 1},${item.format},${escapedBarcode},${date},${time}\n`;
  });

  downloadCsv(csvContent, `inventario_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

export const exportAuditReportCsv = (batch: Batch, filteredExpected?: ExpectedItem[], filteredExtras?: ScanItem[]) => {
  const expected = filteredExpected || getExpectedItemsForBatch(batch.id);
  const scans = getScanItemsForBatch(batch.id);

  let csvContent = 'Status,Código/Patrimônio,Descrição,Categoria,Hora de Localização\n';

  // Expected items
  expected.forEach((item) => {
    const status = item.isFound ? 'ENCONTRADO' : 'FALTANTE';
    const time = item.timestampFound ? `${formatDateStr(item.timestampFound)} ${formatTimeStr(item.timestampFound)}` : '-';
    const desc = item.description ? `"${item.description.replace(/"/g, '""')}"` : 'N/A';
    const cat = item.category ? `"${item.category.replace(/"/g, '""')}"` : 'N/A';
    csvContent += `${status},"${item.barcode}",${desc},${cat},${time}\n`;
  });

  // Extra items (Sobras)
  const finalExtras = filteredExtras || (filteredExpected ? [] : scans.filter(s => {
      const expectedBarcodes = new Set(getExpectedItemsForBatch(batch.id).map(e => e.barcode.toLowerCase()));
      return !expectedBarcodes.has(s.barcode.toLowerCase());
  }));

  if (finalExtras.length > 0) {
      const uniqueExtras = Array.from(new Set(finalExtras.map((s) => s.barcode)));
      uniqueExtras.forEach((code) => {
        const scan = finalExtras.find((s) => s.barcode === code);
        const time = scan ? `${formatDateStr(scan.timestamp)} ${formatTimeStr(scan.timestamp)}` : '-';
        csvContent += `SOBRA DE ESTOQUE,"${code}","Item não constava na lista esperada",${time}\n`;
      });
  }

  downloadCsv(csvContent, `relatorio_conferencia_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

export const exportMultipleBatchesToCsv = (selectedBatches: Batch[], allItems: ScanItem[]) => {
  let csvContent = 'Lote,Tipo,Index,Formato,Conteúdo,Data,Hora\n';
  selectedBatches.forEach((batch) => {
    const batchItems = allItems.filter((item) => item.batchId === batch.id);
    batchItems.forEach((item, index) => {
      const date = formatDateStr(item.timestamp);
      const time = formatTimeStr(item.timestamp);
      const escapedBarcode = item.barcode.includes(',') ? `"${item.barcode}"` : item.barcode;
      const escapedBatchName = batch.name.includes(',') ? `"${batch.name}"` : batch.name;
      csvContent += `${escapedBatchName},${batch.type},${index + 1},${item.format},${escapedBarcode},${date},${time}\n`;
    });
  });

  downloadCsv(csvContent, `inventario_multiplo_${Date.now()}.csv`);
};

// Export ONLY Barcodes / Asset Codes as .CSV (1 item per line separated by comma)
export const exportBatchBarcodesOnly = (
  batch: Batch,
  filter: 'ALL' | 'FOUND' | 'MISSING' | 'SCANS' = 'ALL'
) => {
  const expected = getExpectedItemsForBatch(batch.id);
  const scans = getScanItemsForBatch(batch.id);

  let codes: string[] = [];

  if (batch.type === 'COLLECTION' || filter === 'SCANS') {
    codes = scans.map((s) => s.barcode);
  } else if (filter === 'FOUND') {
    codes = expected.filter((e) => e.isFound).map((e) => e.barcode);
  } else if (filter === 'MISSING') {
    codes = expected.filter((e) => !e.isFound).map((e) => e.barcode);
  } else {
    // ALL expected + extras
    const expectedCodes = expected.map((e) => e.barcode);
    const extraCodes = scans
      .filter((s) => !expectedCodes.some((ec) => ec.toLowerCase() === s.barcode.toLowerCase()))
      .map((s) => s.barcode);

    codes = [...expectedCodes, ...extraCodes];
  }

  // Deduplicate preserving order
  const uniqueCodes = Array.from(new Set(codes.filter((c) => c && c.trim().length > 0)));
  const csvContent = uniqueCodes.map((code) => `${code.trim()},`).join('\n');

  downloadCsv(csvContent, `codigos_${batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.csv`);
};

export const exportMultipleBatchesBarcodesOnly = (selectedBatches: Batch[]) => {
  let allCodes: string[] = [];

  selectedBatches.forEach((batch) => {
    const expected = getExpectedItemsForBatch(batch.id);
    const scans = getScanItemsForBatch(batch.id);

    const bExpectedCodes = expected.map((e) => e.barcode);
    const bScanCodes = scans.map((s) => s.barcode);

    allCodes = [...allCodes, ...bExpectedCodes, ...bScanCodes];
  });

  const uniqueCodes = Array.from(new Set(allCodes.filter((c) => c && c.trim().length > 0)));
  const csvContent = uniqueCodes.map((code) => `${code.trim()},`).join('\n');

  downloadCsv(csvContent, `codigos_consolidados_${Date.now()}.csv`);
};

const downloadTxt = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadCsv = (csvContent: string, filename: string) => {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Settings API
export interface AssetRecord {
  id: string;
  barcode: string;
  description: string;
  category: string;
  batchId: number;
  batchName: string;
  batchType: BatchType;
  status: 'ENCONTRADO' | 'PENDENTE' | 'SOBRA' | 'COLETADO';
  timestamp?: number;
}

export const getAllAssetRecords = (): AssetRecord[] => {
  const batches = getStoredBatches();
  const batchMap = new Map(batches.map(b => [b.id, b]));

  const expectedItems = getStoredExpectedItems();
  const scanItems = getStoredScanItems();

  const records: AssetRecord[] = [];

  // 1. Process expected items (Verification batches)
  expectedItems.forEach(exp => {
    const batch = batchMap.get(exp.batchId);
    records.push({
      id: `exp-${exp.id}`,
      barcode: exp.barcode,
      description: exp.description || 'Patrimônio de Auditoria',
      category: exp.category || 'Geral',
      batchId: exp.batchId,
      batchName: batch ? batch.name : `Lote #${exp.batchId}`,
      batchType: 'VERIFICATION',
      status: exp.isFound ? 'ENCONTRADO' : 'PENDENTE',
      timestamp: exp.timestampFound,
    });
  });

  // 2. Process scan items for Extra (sobras) or Collection batches
  scanItems.forEach(scan => {
    const batch = batchMap.get(scan.batchId);
    const batchType = batch ? batch.type : 'COLLECTION';

    if (batchType === 'COLLECTION') {
      records.push({
        id: `scan-${scan.id}`,
        barcode: scan.barcode,
        description: 'Item Coletado',
        category: 'Coleta Direta',
        batchId: scan.batchId,
        batchName: batch ? batch.name : `Lote #${scan.batchId}`,
        batchType: 'COLLECTION',
        status: 'COLETADO',
        timestamp: scan.timestamp,
      });
    } else {
      // Check if this scan was an extra (sobra) in verification batch
      const matchedExpected = expectedItems.find(
        e => e.batchId === scan.batchId && e.barcode.toLowerCase() === scan.barcode.toLowerCase()
      );
      if (!matchedExpected) {
        records.push({
          id: `extra-${scan.id}`,
          barcode: scan.barcode,
          description: 'Sobra de Estoque / Não cadastrado',
          category: 'Extra',
          batchId: scan.batchId,
          batchName: batch ? batch.name : `Lote #${scan.batchId}`,
          batchType: 'VERIFICATION',
          status: 'SOBRA',
          timestamp: scan.timestamp,
        });
      }
    }
  });

  return records;
};

// Close/Conclude Batch
export const closeBatch = (batchId: number, reason?: string) => {
  const batches = getStoredBatches();
  const updated = batches.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        isClosed: true,
        closedReason: reason?.trim() || 'Concluído manualmente',
        closedAt: Date.now(),
      };
    }
    return b;
  });
  saveBatches(updated);
  addAuditLog(batchId, 'BATCH_CLOSED', undefined, `Lote encerrado: ${reason?.trim() || 'Concluído manualmente'}`);
};

export const reopenBatch = (batchId: number) => {
  const batches = getStoredBatches();
  const updated = batches.map((b) => {
    if (b.id === batchId) {
      return {
        ...b,
        isClosed: false,
        closedReason: undefined,
        closedAt: undefined,
      };
    }
    return b;
  });
  saveBatches(updated);
  addAuditLog(batchId, 'BATCH_OPENED', undefined, 'Lote reaberto para conferência');
};

export const consumeDeletePermissionOnce = () => {
  const settings = getStoredSettings();
  if (settings.deletePermission === 'ONCE') {
    const updated = { ...settings, deletePermission: 'LOCKED' as const };
    saveSettings(updated);
    return true;
  }
  return false;
};

export const getStoredSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        deletePermission: 'LOCKED',
        ...parsed,
      };
    }
  } catch (e) {
    console.error('Failed to get settings', e);
  }
  return {
    soundEnabled: true,
    vibrationEnabled: true,
    continuousScan: true,
    scanBeep: true,
    cameraResolution: '1080p',
    autoRemoveDuplicates: true,
    theme: 'dark',
    deletePermission: 'LOCKED',
  };
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
