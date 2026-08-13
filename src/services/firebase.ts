import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
// Safely load local firebase config file if present without breaking builds when ignored by Git
let localConfig: Record<string, string> = {};
try {
  const meta = import.meta as any;
  if (typeof meta.glob === 'function') {
    const configs = meta.glob('../../firebase-applet-config.json', { eager: true });
    const firstKey = Object.keys(configs)[0];
    if (firstKey) {
      localConfig = (configs[firstKey]?.default || configs[firstKey] || {}) as Record<string, string>;
    }
  }
} catch {
  // Local config file missing or ignored in Git
}

const env = ((import.meta as any).env || {}) as Record<string, string>;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || localConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || localConfig.appId || ''
};

const databaseId = env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || '(default)';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore using the custom Database ID provisioned by AI Studio or env
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, databaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Simple anonymous sign-in helper
export const ensureAuthenticated = async () => {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log('Firebase: Autenticação anônima estabelecida com sucesso.');
    } catch (err: any) {
      console.warn('Firebase: Autenticação anônima restrita ou desativada no console. Operando sem autenticação obrigatória.', err?.code || err);
      return null;
    }
  }
  return auth.currentUser;
};

// Types corresponding to local structures for typing the firebase functions
import { Batch, ExpectedItem, ScanItem, AuditLog, DeviceCounter, RegisteredDevice } from '../types';

/**
 * 1.1 & 1.2 Device Counters and Registered Devices Service
 * Gerencia a contagem atômica de instâncias/dispositivos por operador e cadastra aparelhos.
 */
export const getOrCreateDeviceTag = async (baseName: string): Promise<{ deviceTag: string; baseName: string; sequence: number }> => {
  const cleanPrefix = baseName.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'Operador';
  const counterRef = doc(db, 'device_counters', cleanPrefix);

  try {
    await ensureAuthenticated();
    let newCount = 1;
    const snap = await getDoc(counterRef);
    if (snap.exists()) {
      newCount = (Number(snap.data().count) || 0) + 1;
    }
    await setDoc(counterRef, {
      count: newCount,
      updatedAt: Date.now()
    }, { merge: true });

    const deviceTag = `${cleanPrefix}_${newCount}`;
    const deviceRef = doc(db, 'registered_devices', deviceTag);
    await setDoc(deviceRef, {
      deviceTag,
      baseName: cleanPrefix,
      sequence: newCount,
      registeredAt: Date.now()
    }, { merge: true });

    console.log(`Firebase: Dispositivo cadastrado -> ${deviceTag}`);
    return { deviceTag, baseName: cleanPrefix, sequence: newCount };
  } catch (err) {
    console.warn('Firebase: Não foi possível obter contador remoto, usando fallback:', err);
    return { deviceTag: `${cleanPrefix}_1`, baseName: cleanPrefix, sequence: 1 };
  }
};

/**
 * Cloud Sync Service to bidirectional synchronize LocalStorage with Firestore
 * Enforces 'createdBy' ("ADM_WEB", "pedro_1", etc.) and Smart Merge for multi-operator scans.
 */
export const syncToCloud = async (
  localBatches: Batch[],
  localExpectedItems: ExpectedItem[],
  localScanItems: ScanItem[],
  localAuditLogs: AuditLog[],
  deviceTag: string = 'ADM_WEB'
) => {
  const user = await ensureAuthenticated();
  const ownerUid = user?.uid || 'anonymous';

  // 1. Get existing batches in Firestore
  const batchesRef = collection(db, 'batches');
  const querySnapshot = await getDocs(batchesRef);
  
  const cloudBatchesMap = new Map<number, any>();
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    cloudBatchesMap.set(Number(data.id), { docId: docSnap.id, ...data });
  });

  // 2. Synchronize Batches
  for (const localBatch of localBatches) {
    const batchDocId = String(localBatch.id);
    const batchDocRef = doc(db, 'batches', batchDocId);

    const cloudBatch = cloudBatchesMap.get(localBatch.id);
    const createdBy = localBatch.createdBy || cloudBatch?.createdBy || 'ADM_WEB';
    const now = Date.now();

    await setDoc(batchDocRef, {
      id: localBatch.id,
      name: localBatch.name,
      description: localBatch.description || '',
      type: localBatch.type,
      timestamp: localBatch.timestamp,
      isClosed: !!localBatch.isClosed,
      closedReason: localBatch.closedReason || '',
      closedAt: localBatch.closedAt || null,
      createdBy: createdBy,
      lastUploadedBy: deviceTag,
      updatedAt: now,
      ownerUid: ownerUid
    }, { merge: true });

    console.log(`Firebase Sync: Lote '${localBatch.name}' (Criado por: ${createdBy}) sincronizado.`);

    // 3. Smart Merge - Subcoleções
    
    // A. Expected Items Subcollection (Fusão de itens esperados e conferidos)
    const expectedRef = collection(db, 'batches', batchDocId, 'expectedItems');
    const cloudExpectedSnap = await getDocs(expectedRef);
    const cloudExpectedMap = new Map<number, any>();
    cloudExpectedSnap.forEach((d) => {
      cloudExpectedMap.set(Number(d.data().id), { docId: d.id, ...d.data() });
    });

    const localExpectedForBatch = localExpectedItems.filter(e => e.batchId === localBatch.id);
    for (const item of localExpectedForBatch) {
      const itemDocRef = doc(expectedRef, String(item.id));
      const cloudItem = cloudExpectedMap.get(item.id);
      
      // Preserve isFound if found in either local or cloud (Smart Merge)
      const isFoundMerged = item.isFound || cloudItem?.isFound || false;
      const timestampFoundMerged = item.timestampFound || cloudItem?.timestampFound || (isFoundMerged ? Date.now() : null);

      await setDoc(itemDocRef, {
        id: item.id,
        batchId: item.batchId,
        barcode: item.barcode,
        description: item.description || '',
        category: item.category || '',
        isFound: isFoundMerged,
        timestampFound: timestampFoundMerged
      }, { merge: true });
    }

    // B. Scan Items Subcollection (Smart Merge - preserva leituras de todos os aparelhos)
    const scansRef = collection(db, 'batches', batchDocId, 'scanItems');
    const cloudScansSnap = await getDocs(scansRef);
    const cloudScansMap = new Map<string, any>();
    cloudScansSnap.forEach((d) => {
      const sd = d.data();
      cloudScansMap.set(String(sd.id), sd);
      // Also map by barcode to prevent duplicate scans for same barcode
      cloudScansMap.set(`barcode_${sd.barcode.trim().toLowerCase()}`, sd);
    });

    const localScansForBatch = localScanItems.filter(s => s.batchId === localBatch.id);
    for (const scan of localScansForBatch) {
      const scanDocRef = doc(scansRef, String(scan.id));
      const existingByBarcode = cloudScansMap.get(`barcode_${scan.barcode.trim().toLowerCase()}`);
      if (!cloudScansMap.has(String(scan.id)) && !existingByBarcode) {
        await setDoc(scanDocRef, {
          id: scan.id,
          batchId: scan.batchId,
          barcode: scan.barcode,
          format: scan.format,
          timestamp: scan.timestamp
        }, { merge: true });
      }
    }

    // C. Audit Logs Subcollection (Append-only logs)
    const logsRef = collection(db, 'batches', batchDocId, 'auditLogs');
    const cloudLogsSnap = await getDocs(logsRef);
    const cloudLogsMap = new Map<number, any>();
    cloudLogsSnap.forEach((d) => {
      cloudLogsMap.set(Number(d.data().id), d.data());
    });

    const localLogsForBatch = localAuditLogs.filter(l => l.batchId === localBatch.id);
    for (const log of localLogsForBatch) {
      const logDocRef = doc(logsRef, String(log.id));
      if (!cloudLogsMap.has(log.id)) {
        await setDoc(logDocRef, {
          id: log.id,
          batchId: log.batchId,
          timestamp: log.timestamp,
          type: log.type,
          barcode: log.barcode || null,
          message: log.message || ''
        }, { merge: true });
      }
    }
  }
};

/**
 * Fetch and download all synchronized data from Firebase to local Storage
 */
export const downloadFromCloud = async (): Promise<{
  batches: Batch[];
  expectedItems: ExpectedItem[];
  scanItems: ScanItem[];
  auditLogs: AuditLog[];
}> => {
  await ensureAuthenticated();

  const batchesRef = collection(db, 'batches');
  const querySnapshot = await getDocs(batchesRef);

  const batches: Batch[] = [];
  const expectedItems: ExpectedItem[] = [];
  const scanItems: ScanItem[] = [];
  const auditLogs: AuditLog[] = [];

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    const batchDocId = docSnap.id;

    batches.push({
      id: Number(data.id),
      name: data.name,
      description: data.description || '',
      type: data.type,
      timestamp: data.timestamp,
      isClosed: !!data.isClosed,
      closedReason: data.closedReason || '',
      closedAt: data.closedAt || null,
      createdBy: data.createdBy || 'ADM_WEB',
      lastUploadedBy: data.lastUploadedBy || 'ADM_WEB',
      updatedAt: data.updatedAt || data.timestamp
    });

    // Fetch expected items
    const expectedSnap = await getDocs(collection(db, 'batches', batchDocId, 'expectedItems'));
    expectedSnap.forEach((d) => {
      const ed = d.data();
      expectedItems.push({
        id: Number(ed.id),
        batchId: Number(ed.batchId),
        barcode: ed.barcode,
        description: ed.description || '',
        category: ed.category || '',
        isFound: !!ed.isFound,
        timestampFound: ed.timestampFound || undefined
      });
    });

    // Fetch scan items
    const scansSnap = await getDocs(collection(db, 'batches', batchDocId, 'scanItems'));
    scansSnap.forEach((d) => {
      const sd = d.data();
      scanItems.push({
        id: Number(sd.id),
        batchId: Number(sd.batchId),
        barcode: sd.barcode,
        format: sd.format,
        timestamp: sd.timestamp
      });
    });

    // Fetch audit logs
    const logsSnap = await getDocs(collection(db, 'batches', batchDocId, 'auditLogs'));
    logsSnap.forEach((d) => {
      const ld = d.data();
      auditLogs.push({
        id: Number(ld.id),
        batchId: Number(ld.batchId),
        timestamp: ld.timestamp,
        type: ld.type,
        barcode: ld.barcode || undefined,
        message: ld.message || ''
      });
    });
  }

  return { batches, expectedItems, scanItems, auditLogs };
};

/**
 * Register or update changelog in Firestore collection 'changelogs'
 */
export const logChangelogToFirebase = async (
  changelogId: string | number,
  title: string,
  description: string
) => {
  try {
    await ensureAuthenticated();

    const changelogRef = doc(db, 'changelogs', String(changelogId));
    await setDoc(changelogRef, {
      id: changelogId,
      title,
      description,
      author: 'Gemini AI',
      timestamp: Date.now()
    }, { merge: true });
    console.log(`Firebase Changelog registrado: ${title}`);
  } catch (err) {
    console.warn('Aviso: Não foi possível registrar changelog no Firebase:', err);
  }
};

