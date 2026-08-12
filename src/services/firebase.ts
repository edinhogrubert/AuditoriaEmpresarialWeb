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
import { Batch, ExpectedItem, ScanItem, AuditLog } from '../types';

/**
 * Cloud Sync Service to bidirectional synchronize LocalStorage with Firestore
 */
export const syncToCloud = async (
  localBatches: Batch[],
  localExpectedItems: ExpectedItem[],
  localScanItems: ScanItem[],
  localAuditLogs: AuditLog[]
) => {
  const user = await ensureAuthenticated();
  if (!user) throw new Error('Não autenticado no Firebase.');

  const ownerUid = user.uid;

  // 1. Get existing batches in Firestore to compare
  const batchesRef = collection(db, 'batches');
  const q = query(batchesRef, where('ownerUid', '==', ownerUid));
  const querySnapshot = await getDocs(q);
  
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
    if (!cloudBatch) {
      // Create new batch in Firestore
      await setDoc(batchDocRef, {
        id: localBatch.id,
        name: localBatch.name,
        description: localBatch.description || '',
        type: localBatch.type,
        timestamp: localBatch.timestamp,
        isClosed: !!localBatch.isClosed,
        closedReason: localBatch.closedReason || '',
        closedAt: localBatch.closedAt || null,
        ownerUid: ownerUid
      });
      console.log(`Firebase Sync: Lote '${localBatch.name}' enviado.`);
    } else {
      // If local batch is modified, update cloud
      if (
        localBatch.name !== cloudBatch.name ||
        (localBatch.description || '') !== (cloudBatch.description || '') ||
        !!localBatch.isClosed !== !!cloudBatch.isClosed
      ) {
        await setDoc(batchDocRef, {
          id: localBatch.id,
          name: localBatch.name,
          description: localBatch.description || '',
          type: localBatch.type,
          timestamp: localBatch.timestamp,
          isClosed: !!localBatch.isClosed,
          closedReason: localBatch.closedReason || '',
          closedAt: localBatch.closedAt || null,
          ownerUid: ownerUid
        }, { merge: true });
        console.log(`Firebase Sync: Lote '${localBatch.name}' atualizado.`);
      }
    }

    // Synchronize subcollections for this batch: scanItems, expectedItems, auditLogs
    
    // A. Expected Items Subcollection
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
      if (!cloudItem || item.isFound !== cloudItem.isFound || item.timestampFound !== cloudItem.timestampFound) {
        await setDoc(itemDocRef, {
          id: item.id,
          batchId: item.batchId,
          barcode: item.barcode,
          description: item.description || '',
          category: item.category || '',
          isFound: !!item.isFound,
          timestampFound: item.timestampFound || null
        }, { merge: true });
      }
    }

    // B. Scan Items Subcollection
    const scansRef = collection(db, 'batches', batchDocId, 'scanItems');
    const cloudScansSnap = await getDocs(scansRef);
    const cloudScansMap = new Map<number, any>();
    cloudScansSnap.forEach((d) => {
      cloudScansMap.set(Number(d.data().id), { docId: d.id, ...d.data() });
    });

    const localScansForBatch = localScanItems.filter(s => s.batchId === localBatch.id);
    for (const scan of localScansForBatch) {
      const scanDocRef = doc(scansRef, String(scan.id));
      const cloudScan = cloudScansMap.get(scan.id);
      if (!cloudScan) {
        await setDoc(scanDocRef, {
          id: scan.id,
          batchId: scan.batchId,
          barcode: scan.barcode,
          format: scan.format,
          timestamp: scan.timestamp
        });
      }
    }

    // C. Audit Logs Subcollection
    const logsRef = collection(db, 'batches', batchDocId, 'auditLogs');
    const cloudLogsSnap = await getDocs(logsRef);
    const cloudLogsMap = new Map<number, any>();
    cloudLogsSnap.forEach((d) => {
      cloudLogsMap.set(Number(d.data().id), d.data());
    });

    const localLogsForBatch = localAuditLogs.filter(l => l.batchId === localBatch.id);
    for (const log of localLogsForBatch) {
      const logDocRef = doc(logsRef, String(log.id));
      const cloudLog = cloudLogsMap.get(log.id);
      if (!cloudLog) {
        await setDoc(logDocRef, {
          id: log.id,
          batchId: log.batchId,
          timestamp: log.timestamp,
          type: log.type,
          barcode: log.barcode || null,
          message: log.message || ''
        });
      }
    }
  }

  // Delete cloud batches that are deleted locally (only if local count is different)
  const localBatchIds = new Set(localBatches.map(b => b.id));
  for (const [cloudId, cloudBatch] of cloudBatchesMap.entries()) {
    if (!localBatchIds.has(cloudId)) {
      const batchDocRef = doc(db, 'batches', String(cloudId));
      await deleteDoc(batchDocRef);
      console.log(`Firebase Sync: Lote deletado na nuvem (id: ${cloudId}).`);
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
  const user = await ensureAuthenticated();
  if (!user) throw new Error('Não autenticado no Firebase.');

  const ownerUid = user.uid;

  // 1. Fetch batches
  const batchesRef = collection(db, 'batches');
  const q = query(batchesRef, where('ownerUid', '==', ownerUid));
  const querySnapshot = await getDocs(q);

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
      description: data.description,
      type: data.type,
      timestamp: data.timestamp,
      isClosed: !!data.isClosed,
      closedReason: data.closedReason,
      closedAt: data.closedAt
    });

    // Fetch expected items
    const expectedSnap = await getDocs(collection(db, 'batches', batchDocId, 'expectedItems'));
    expectedSnap.forEach((d) => {
      const ed = d.data();
      expectedItems.push({
        id: Number(ed.id),
        batchId: Number(ed.batchId),
        barcode: ed.barcode,
        description: ed.description,
        category: ed.category,
        isFound: !!ed.isFound,
        timestampFound: ed.timestampFound
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
        barcode: ld.barcode,
        message: ld.message
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

