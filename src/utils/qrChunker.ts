import { Batch, ExpectedItem, ScanItem, AppSettings, AuditLog } from '../types';

export interface QrChunkParseResult {
  isChunk: boolean;
  transferId: string;
  currentPart: number;
  totalParts: number;
  chunkData: string;
  rawText: string;
}

/**
 * Splits a JSON string or object into manageable QR Code chunks if needed.
 */
export function createQrChunks(payload: any, maxChunkLength: number = 300): string[] {
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const transferId = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (jsonStr.length <= maxChunkLength) {
    return [`CHUNK:1/1:${transferId}:${jsonStr}`];
  }

  const chunks: string[] = [];
  const totalParts = Math.ceil(jsonStr.length / maxChunkLength);

  for (let i = 0; i < totalParts; i++) {
    const start = i * maxChunkLength;
    const end = start + maxChunkLength;
    const slice = jsonStr.slice(start, end);
    const partNum = i + 1;
    chunks.push(`CHUNK:${partNum}/${totalParts}:${transferId}:${slice}`);
  }

  return chunks;
}

/**
 * Parses a scanned string to check if it's part of a multi-chunk QR payload.
 */
export function parseQrChunk(scannedText: string): QrChunkParseResult {
  const trimmed = scannedText.trim();
  const chunkRegex = /^CHUNK:(\d+)\/(\d+):([A-Z0-9]+):([\s\S]*)$/i;
  const match = trimmed.match(chunkRegex);

  if (match) {
    const currentPart = parseInt(match[1], 10);
    const totalParts = parseInt(match[2], 10);
    const transferId = match[3];
    const chunkData = match[4];

    return {
      isChunk: true,
      transferId,
      currentPart,
      totalParts,
      chunkData,
      rawText: trimmed,
    };
  }

  return {
    isChunk: false,
    transferId: 'SINGLE',
    currentPart: 1,
    totalParts: 1,
    chunkData: trimmed,
    rawText: trimmed,
  };
}

/**
 * Reconstructs the original payload string once all chunks have been collected.
 */
export function combineQrChunks(chunksMap: Map<number, string>, totalParts: number): string {
  let reconstructed = '';
  for (let i = 1; i <= totalParts; i++) {
    const chunk = chunksMap.get(i);
    if (!chunk) {
      throw new Error(`Parte ${i} de ${totalParts} está ausente.`);
    }
    reconstructed += chunk;
  }
  return reconstructed;
}

export interface BackupData {
  batches: Batch[];
  items: ScanItem[];
  expected: ExpectedItem[];
  logs?: AuditLog[];
  settings?: AppSettings;
  exportedAt: string;
  version: string;
}

/**
 * Exports a full JSON backup of the application.
 */
export function generateFullBackup(): BackupData {
  const batches = JSON.parse(localStorage.getItem('inventario_batches_v2') || '[]');
  const items = JSON.parse(localStorage.getItem('inventario_scan_items_v2') || '[]');
  const expected = JSON.parse(localStorage.getItem('inventario_expected_items_v2') || '[]');
  const logs = JSON.parse(localStorage.getItem('inventario_audit_logs_v2') || '[]');
  const settings = JSON.parse(localStorage.getItem('inventario_settings_v2') || '{}');

  return {
    batches,
    items,
    expected,
    logs,
    settings,
    exportedAt: new Date().toISOString(),
    version: '2.1',
  };
}

/**
 * Restores a full backup using either Full Reset or Smart Merge strategy.
 */
export function restoreBackup(backup: BackupData, mode: 'REPLACE' | 'MERGE'): {
  importedBatchesCount: number;
  importedItemsCount: number;
  importedExpectedCount: number;
} {
  if (mode === 'REPLACE') {
    localStorage.setItem('inventario_batches_v2', JSON.stringify(backup.batches || []));
    localStorage.setItem('inventario_scan_items_v2', JSON.stringify(backup.items || []));
    localStorage.setItem('inventario_expected_items_v2', JSON.stringify(backup.expected || []));
    if (backup.logs) localStorage.setItem('inventario_audit_logs_v2', JSON.stringify(backup.logs));
    if (backup.settings) localStorage.setItem('inventario_settings_v2', JSON.stringify(backup.settings));

    return {
      importedBatchesCount: (backup.batches || []).length,
      importedItemsCount: (backup.items || []).length,
      importedExpectedCount: (backup.expected || []).length,
    };
  } else {
    // MERGE STRATEGY
    const existingBatches: Batch[] = JSON.parse(localStorage.getItem('inventario_batches_v2') || '[]');
    const existingItems: ScanItem[] = JSON.parse(localStorage.getItem('inventario_scan_items_v2') || '[]');
    const existingExpected: ExpectedItem[] = JSON.parse(localStorage.getItem('inventario_expected_items_v2') || '[]');

    const batchIdMap = new Map<number, number>(); // Old Batch ID -> New Batch ID if collision

    const mergedBatches = [...existingBatches];
    let newBatchesAdded = 0;

    (backup.batches || []).forEach(b => {
      const existing = existingBatches.find(eb => eb.id === b.id);
      if (!existing) {
        mergedBatches.push(b);
        batchIdMap.set(b.id, b.id);
        newBatchesAdded++;
      } else {
        // If ID matches but name/content is different, re-id it
        const newId = Date.now() + Math.floor(Math.random() * 10000);
        batchIdMap.set(b.id, newId);
        mergedBatches.push({ ...b, id: newId, name: `${b.name} (Importado)` });
        newBatchesAdded++;
      }
    });

    const mergedItems = [...existingItems];
    let newItemsAdded = 0;
    const itemKeySet = new Set(existingItems.map(i => `${i.batchId}_${i.barcode.toLowerCase()}_${i.timestamp}`));

    (backup.items || []).forEach(item => {
      const targetBatchId = batchIdMap.get(item.batchId) || item.batchId;
      const key = `${targetBatchId}_${item.barcode.toLowerCase()}_${item.timestamp}`;
      if (!itemKeySet.has(key)) {
        mergedItems.push({
          ...item,
          id: Date.now() + Math.floor(Math.random() * 100000),
          batchId: targetBatchId,
        });
        itemKeySet.add(key);
        newItemsAdded++;
      }
    });

    const mergedExpected = [...existingExpected];
    let newExpectedAdded = 0;
    const expKeySet = new Set(existingExpected.map(e => `${e.batchId}_${e.barcode.toLowerCase()}`));

    (backup.expected || []).forEach(exp => {
      const targetBatchId = batchIdMap.get(exp.batchId) || exp.batchId;
      const key = `${targetBatchId}_${exp.barcode.toLowerCase()}`;
      if (!expKeySet.has(key)) {
        mergedExpected.push({
          ...exp,
          id: Date.now() + Math.floor(Math.random() * 100000),
          batchId: targetBatchId,
        });
        expKeySet.add(key);
        newExpectedAdded++;
      }
    });

    localStorage.setItem('inventario_batches_v2', JSON.stringify(mergedBatches));
    localStorage.setItem('inventario_scan_items_v2', JSON.stringify(mergedItems));
    localStorage.setItem('inventario_expected_items_v2', JSON.stringify(mergedExpected));

    return {
      importedBatchesCount: newBatchesAdded,
      importedItemsCount: newItemsAdded,
      importedExpectedCount: newExpectedAdded,
    };
  }
}

/**
 * Universal JSON importer that handles full backup JSON, single batch JSON, or item lists.
 */
export function importAnyJsonData(
  jsonObj: any,
  fallbackName: string = 'Lote Importado'
): { importedBatchesCount: number; importedItemsCount: number; importedExpectedCount: number; batchId?: number } {
  if (!jsonObj) {
    throw new Error('Conteúdo JSON vazio ou inválido.');
  }

  // 1. Full Backup format { batches: [...], items: [...], expected: [...] }
  if (jsonObj.batches && Array.isArray(jsonObj.batches)) {
    const stats = restoreBackup(jsonObj as BackupData, 'MERGE');
    const firstBatchId = jsonObj.batches[0]?.id;
    return { ...stats, batchId: firstBatchId };
  }

  // 2. Single Batch JSON { name: "...", expected: [...], items: [...] } or { batch: {...}, expected: [...] }
  const batchMeta = jsonObj.batch || (jsonObj.name ? jsonObj : null);
  const rawExpected = jsonObj.expected || jsonObj.itemsList || jsonObj.items || (Array.isArray(jsonObj) ? jsonObj : []);

  if (batchMeta || (Array.isArray(rawExpected) && rawExpected.length > 0)) {
    const batchName = batchMeta?.name || fallbackName || `Auditoria - ${new Date().toLocaleDateString('pt-BR')}`;
    const batchDesc = batchMeta?.description || 'Importado via JSON';
    const newBatchId = Date.now() + Math.floor(Math.random() * 1000);

    const newBatch: Batch = {
      id: newBatchId,
      name: batchName,
      description: batchDesc,
      type: batchMeta?.type || 'VERIFICATION',
      timestamp: Date.now(),
      isClosed: false,
    };

    const expectedItems: ExpectedItem[] = [];
    const scanItems: ScanItem[] = [];

    if (Array.isArray(rawExpected)) {
      rawExpected.forEach((item: any, idx: number) => {
        const barcode = String(item.barcode || item.code || item.id || item.patrimonio || '').trim();
        if (barcode) {
          expectedItems.push({
            id: Date.now() + idx,
            batchId: newBatchId,
            barcode,
            description: String(item.description || item.desc || item.nome || 'Item do Lote').trim(),
            category: String(item.category || item.grupo || item.setor || 'Geral').trim(),
            isFound: Boolean(item.isFound || item.scanned || item.isScanned),
            timestampFound: item.timestampFound || (item.scanned ? Date.now() : undefined),
          });

          // If scanned items are present
          if (item.scanned || item.isScanned || item.timestamp) {
            scanItems.push({
              id: Date.now() + idx + 50000,
              batchId: newBatchId,
              barcode,
              format: item.format || 'QR_CODE',
              timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
            });
          }
        }
      });
    }

    const backupPayload: BackupData = {
      batches: [newBatch],
      expected: expectedItems,
      items: scanItems,
      exportedAt: new Date().toISOString(),
      version: '2.1',
    };

    const stats = restoreBackup(backupPayload, 'MERGE');
    return { ...stats, batchId: newBatchId };
  }

  throw new Error('Não foi possível identificar dados de lote ou patrimônios no arquivo JSON.');
}

