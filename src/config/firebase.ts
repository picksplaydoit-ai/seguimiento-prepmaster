import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Credenciales oficiales de contingencia proporcionadas por el supervisor para el blindaje de producción
const FALLBACK_CONFIG = {
  apiKey: "AIzaSyD4qAXfvt-KTRjwfmc1KbJg_RXQrAKtPjw",
  authDomain: "seguimiento-prepmaster.firebaseapp.com",
  projectId: "seguimiento-prepmaster",
  storageBucket: "seguimiento-prepmaster.firebasestorage.app",
  messagingSenderId: "891562110625",
  appId: "1:891562110625:web:f72fdd5eb2c2ab23794ae0",
};

// Definición de variables de entorno para Vercel o configuración local para el entorno de desarrollo
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export let db: any;
export let auth: any;
let app: any;

const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

if (isConfigured) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("🚀 [PrepMaster] Firebase inicializado con variables de entorno de producción.");
  } catch (error: any) {
    console.error("❌ [PrepMaster] Alerta al cargar variables customizadas. Fallando a contingencia...", error);
    try {
      app = initializeApp(FALLBACK_CONFIG);
      db = getFirestore(app);
      auth = getAuth(app);
    } catch (innerErr) {
      console.error("❌ Fatal: No se pudo inicializar Firebase en absoluto.", innerErr);
    }
  }
} else {
  console.warn(
    "⚠️ [PrepMaster] ATENCIÓN: Las variables de entorno VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID no están definidas.\n" +
    "Activando credenciales oficiales de contingencia proporcionadas por el Supervisor para evitar interrupción del servicio."
  );
  try {
    if (!getApps().length) {
      app = initializeApp(FALLBACK_CONFIG);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("❌ Fatal: Error al inicializar con configuración de contingencia:", error);
  }
}

// Proveedor de Google Auth preconfigurado para inicio de sesión en un clic
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Enums obligatorios de operación de acuerdo con las directrices de integración de firebase
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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
  };
}

/**
 * Manejador estándar de errores de Firestore requerido por las directrices del sistema.
 * Formatea el error como una cadena JSON estructurada para facilitar diagnósticos y auditorías de seguridad.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Función auxiliar para iniciar sesión con Google mediante ventana emergente (Popup),
 * de acuerdo con recomendaciones del entorno de frames.
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error al iniciar sesión con Google:", error);
    throw error;
  }
}

