import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Definición de variables de entorno para Vercel o configuración local para el entorno de desarrollo
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Validación defensiva estricta de variables de entorno obligatorias
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId
);

export let db: any;
export let auth: any;

// Función para crear un proxy amigable de contingencia si Firebase no está disponible
function createFallbackProxy(serviceName: string) {
  return new Proxy({} as any, {
    get(target, prop) {
      if (prop === 'onAuthStateChanged') {
        return (callback: (user: any) => void) => {
          console.info(`[PrepMaster] ℹ️ Simulando sesión vacía de Firebase Auth (Modo de contingencia por variables faltantes).`);
          setTimeout(() => callback(null), 150);
          return () => {}; // Descalibrador de escucha dummy
        };
      }
      return (...args: any[]) => {
        throw new Error(
          `[PrepMaster] El servicio ${serviceName} no está disponible. ` +
          `Asegúrate de configurar las variables de entorno VITE_FIREBASE_API_KEY y ` +
          `VITE_FIREBASE_PROJECT_ID en tu archivo .env o configuración de entorno.`
        );
      };
    }
  });
}

if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error: any) {
    console.error("❌ [PrepMaster] Error crítico de inicialización de Firebase:", error);
    db = createFallbackProxy("Firestore");
    auth = createFallbackProxy("Auth");
  }
} else {
  console.error(
    "%c⚠️ [PrepMaster] ATENCIÓN: CONFIGURACIÓN DE FIREBASE NO COMPLETA ⚠️\n" +
    "La clave 'VITE_FIREBASE_API_KEY' o 'VITE_FIREBASE_PROJECT_ID' no están definidas en las variables de entorno.\n" +
    "Para corregir este estado:\n" +
    "1. Configura tus credenciales de Firebase en el archivo .env.local o en el panel del entorno del servidor.\n" +
    "2. Agrega las claves requeridas:\n" +
    "   - VITE_FIREBASE_API_KEY\n" +
    "   - VITE_FIREBASE_PROJECT_ID\n" +
    "La aplicación se ha inicializado en modo degradado defensivo para prevenir la pantalla blanca de muerte (Uncaught FirebaseError).",
    "color: #ea4335; font-weight: bold; font-size: 13px;"
  );
  db = createFallbackProxy("Firestore");
  auth = createFallbackProxy("Auth");
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

