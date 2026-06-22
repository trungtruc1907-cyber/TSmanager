import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, collection, addDoc, serverTimestamp, persistentLocalCache, persistentMultipleTabManager, enableNetwork } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const dbId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-b2d8e0e9-52cd-42ef-bb50-f9a1cebfcf8b";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
}, dbId);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const isOffline = error instanceof Error && (
    error.message.toLowerCase().includes('offline') || 
    error.message.toLowerCase().includes('failed to get document')
  );

  if (isOffline) {
    console.warn('Firestore Offline/Network Notice: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }

  // Prevent crashing the component tree during background query listener synchronization
  if (operationType === OperationType.GET || operationType === OperationType.LIST) {
    return;
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity check as per guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firebase is running in offline mode. Syncing will resume when online.");
    }
  }
}
// Run connection check in background after initial render to avoid blocking
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(testConnection, 2000);
  });
}

// Try forcing reconnection to Firestore servers
export async function reconnectFirestore() {
  try {
    await enableNetwork(db);
    console.log("Forced Firestore network reconnection call triggered.");
  } catch (error) {
    console.error("Manual reconnectFirestore failed:", error);
  }
}

export async function createNotification(
  type: 'customer' | 'appointment' | 'task',
  title: string,
  message: string
) {
  try {
    const curUser = auth.currentUser;
    const createdBy = curUser?.uid || 'system';
    const createdByName = curUser?.displayName || curUser?.email?.split('@')[0] || 'Nhân viên';

    await addDoc(collection(db, 'notifications'), {
      type,
      title,
      message,
      createdBy,
      createdByName,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to create unified notification:", error);
  }
}
