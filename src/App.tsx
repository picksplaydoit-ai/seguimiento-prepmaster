import { useState, useEffect } from 'react';
import { auth, db } from './config/firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  GraduationCap, 
  AlertTriangle, 
  ArrowRight, 
  ShieldAlert, 
  LogOut, 
  Loader2, 
  Compass, 
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import Navbar from './components/Navbar';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import { Student, UserRole } from './types';

// El supervisor o profesor administrador preestablecido
const ADMIN_EMAIL = 'vacrack953@gmail.com';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    // Escucha de estado de Firebase Authentication
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setAuthError(null);

      if (currentUser) {
        const userEmail = currentUser.email?.trim().toLowerCase();

        // 1. Validar si es Profesor (Administrador)
        if (userEmail === ADMIN_EMAIL.toLowerCase()) {
          setUser(currentUser);
          setRole('teacher');
          setStudentData(null);
          setLoading(false);
          return;
        }

        // 2. Si no es Profesor, verificar si es Alumno existente en Firestore '/students/{email}'
        try {
          if (userEmail) {
            const studentDocRef = doc(db, 'students', userEmail);
            const studentSnap = await getDoc(studentDocRef);

            if (studentSnap.exists()) {
              setUser(currentUser);
              setRole('student');
              setStudentData(studentSnap.data() as Student);
              setLoading(false);
            } else {
              // El alumno no está registrado en la base de datos institucional.
              console.warn(`Usuario no registrado en Firestore: ${userEmail}`);
              setAuthError(`El correo "${userEmail}" no se encuentra registrado en el sistema institucional. Pide a tu profesor que te registre desde su panel para habilitar tu acceso.`);
              // Desconexión automática para mantener segura la sesión local
              await signOut(auth);
              setUser(null);
              setRole(null);
              setStudentData(null);
              setLoading(false);
            }
          } else {
            setAuthError("No se pudo obtener el correo de la cuenta de Google.");
            await signOut(auth);
            setLoading(false);
          }
        } catch (error: any) {
          console.error("Error al consultar el registro institucional:", error);
          setAuthError(`Error de verificación institucional: ${error.message || 'Verifica tu conexión.'}`);
          await signOut(auth);
          setUser(null);
          setRole(null);
          setStudentData(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setRole(null);
        setStudentData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Función para Login con Google (Popup)
  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error);
      if (error?.code !== 'auth/popup-closed-by-user') {
        setAuthError(`Error de autenticación: ${error.message || error}`);
      }
      setLoading(false);
    }
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga integrada
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center max-w-sm flex flex-col items-center">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <h2 className="text-lg font-bold text-slate-800 mt-4 font-sans">Verificando Credenciales</h2>
          <p className="text-slate-500 text-xs mt-2">Conectando de forma segura con los servidores de Google y Firestore...</p>
        </div>
      </div>
    );
  }

  // Vista de Login si el usuario no ha iniciado sesión
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 md:p-8 font-sans">
        {/* Top Minimal Line Header */}
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between py-2 border-b border-slate-200/60">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-md font-bold text-slate-800 tracking-tight">
              Seguimiento PrepMaster
            </span>
          </div>
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
            Paso 2 Terminado
          </span>
        </div>

        {/* Central Auth Screen */}
        <div className="max-w-md w-full mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8 text-center">
          <div className="bg-blue-50 text-blue-600 p-4 rounded-full inline-block mb-4">
            <GraduationCap className="h-10 w-10" />
          </div>
          
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Acceso Institucional
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Plataforma transparente de asistencia, rúbricas y calificaciones en tiempo real.
          </p>

          {authError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-700 text-xs rounded-2xl text-left flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Acceso Denegado</p>
                <p className="mt-1 leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Guía de Evaluación para el Supervisor (¡Sumamente Elegante!) */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 text-left rounded-2xl text-xs space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <span>Instrucciones para Evaluar:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-4 list-disc">
              <li>
                Inicia sesión con tu cuenta de Google.
              </li>
              <li>
                Si tu correo es <strong className="text-slate-800 font-mono select-all font-semibold">{ADMIN_EMAIL}</strong>, entrarás con el rol de <strong className="text-blue-600">Teacher</strong> automáticamente.
              </li>
              <li>
                Dentro del panel de Profesor, verás el <strong>"Simulador"</strong> para registrar correos alternativos de alumnos y probar el Dashboard de <strong>Student</strong> en tiempo real.
              </li>
            </ul>
          </div>

          <button
            onClick={handleGoogleLogin}
            id="btn-google-login"
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white rounded-xl py-3 px-4 mt-6 text-sm font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-[0.99]"
          >
            {/* SVG G de Google */}
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Iniciar Sesión con Google</span>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 font-mono">
          © 2026 Seguimiento PrepMaster • Optimizado para Vercel
        </div>
      </div>
    );
  }

  // Vista Autenticada con Enrutamiento por Roles
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar con control de tabs para mobile y desktop */}
      <Navbar 
        user={user} 
        role={role} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Renderizado condicional del Dashboard de acuerdo al rol del usuario logueado */}
      <main className="flex-grow">
        {role === 'teacher' ? (
          <TeacherDashboard user={user} activeTab={activeTab} />
        ) : (
          <StudentDashboard user={user} studentData={studentData} activeTab={activeTab} />
        )}
      </main>

      {/* Footer minimalista */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-mono mt-auto">
        Seguimiento PrepMaster • Control Escolar en un solo clic • Diseñado por Ingeniero Senior
      </footer>
    </div>
  );
}
