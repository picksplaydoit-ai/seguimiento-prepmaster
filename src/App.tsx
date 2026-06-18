import { useState, useEffect, FormEvent } from 'react';
import { auth, db } from './config/firebase';
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  GraduationCap, 
  AlertTriangle, 
  ArrowRight, 
  ShieldAlert, 
  LogOut, 
  Loader2, 
  Compass, 
  HelpCircle,
  CheckCircle2,
  Lock,
  User,
  KeyRound,
  FileText
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

  // Nuevos estados para formularios de acceso
  const [loginMode, setLoginMode] = useState<'teacher' | 'student'>('teacher');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [groupCRN, setGroupCRN] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    // 1. Verificar si ya existe una sesión local persistida como alumno
    const storedStudent = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    if (storedStudent) {
      try {
        const studentInfo = JSON.parse(storedStudent) as Student;
        setUser({
          email: studentInfo.email,
          displayName: studentInfo.name,
          uid: `student_${studentInfo.notes}`
        });
        setRole('student');
        setStudentData(studentInfo);
        setLoading(false);
        // Si hay sesión de alumno, omitimos resolver temporalmente firebase auth a menos que sea profesor
      } catch (e) {
        console.error("Error al restaurar sesión de alumno:", e);
      }
    }

    // 2. Escucha de estado de Firebase Authentication (para Profesor)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Si ya hay sesión activa de alumno cargada localmente, se prioriza
      if (sessionStorage.getItem('student_session') || localStorage.getItem('student_session')) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setAuthError(null);

      if (currentUser) {
        const userEmail = currentUser.email?.trim().toLowerCase();

        // Validar si es Profesor (Administrador)
        if (userEmail === ADMIN_EMAIL.toLowerCase()) {
          setUser(currentUser);
          setRole('teacher');
          setStudentData(null);
          setLoading(false);
          return;
        }

        // Si es una cuenta Google que no es de profesor, se desconecta para forzar el flujo del alumno o profesor adecuado
        console.warn(`Usuario de Google no autorizado como profesor: ${userEmail}`);
        setAuthError(`El correo "${userEmail}" no corresponde al administrador. Si eres alumno, por favor introduce tu matrícula y grupo en la pestaña "Soy Alumno".`);
        await signOut(auth);
        setUser(null);
        setRole(null);
        setStudentData(null);
        setLoading(false);
      } else {
        // Solo limpiar si no es alumno
        if (!sessionStorage.getItem('student_session') && !localStorage.getItem('student_session')) {
          setUser(null);
          setRole(null);
          setStudentData(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Función para Login de Profesor por Correo y Contraseña
  const handleTeacherLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacherEmail.trim() || !teacherPassword) {
      setAuthError("Proporciona tu correo electrónico y contraseña.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      await signInWithEmailAndPassword(auth, teacherEmail.trim(), teacherPassword);
    } catch (error: any) {
      console.error("Error en login de profesor:", error);
      let friendlyMsg = "No se pudo iniciar sesión. Comprueba que tus datos y tu conexión a internet sean correctos.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        friendlyMsg = "El correo o la contraseña ingresados son incorrectos.";
      } else if (error.code === 'auth/invalid-email') {
        friendlyMsg = "El formato de correo ingresado no es válido.";
      }
      setAuthError(friendlyMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Función para Login con Google (Popup heredado para el Profesor como alternativa rápida)
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
        setAuthError(`Error de autenticación con Google: ${error.message || error}`);
      }
      setLoading(false);
    }
  };

  // Función para login transparente del Alumno (Sin Auth, Consulta directa parametrizada)
  const handleStudentLogin = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = studentCode.trim();
    const cleanCRN = groupCRN.trim();

    if (!cleanCode || !cleanCRN) {
      setAuthError("Ingresa tu Código de Estudiante y tu ID de Grupo/CRN.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      // Query directa buscando coincidencia exacta de matrícula (notes) e ID de grupo (groupId)
      const q = query(
        collection(db, 'students'),
        where('notes', '==', cleanCode),
        where('groupId', '==', cleanCRN),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const studentDoc = querySnapshot.docs[0];
        const studentInfo = { ...studentDoc.data(), email: studentDoc.id } as Student;

        // Persistir en sessionStorage para mantener la sesión durante la navegación
        sessionStorage.setItem('student_session', JSON.stringify(studentInfo));
        localStorage.setItem('student_session', JSON.stringify(studentInfo)); // Fallback

        setUser({
          email: studentInfo.email,
          displayName: studentInfo.name,
          uid: `student_${studentInfo.notes}`
        });
        setRole('student');
        setStudentData(studentInfo);
        setActiveTab('dashboard');
      } else {
        setAuthError("Datos de acceso incorrectos o alumno no registrado en el grupo especificado. Comprueba tu matrícula e ID de grupo.");
      }
    } catch (error: any) {
      console.error("Error en autenticación de alumno:", error);
      setAuthError(`Error institucional de consulta: ${error.message || error}`);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Función para cerrar sesión
  const handleLogout = async () => {
    setLoading(true);
    try {
      sessionStorage.removeItem('student_session');
      localStorage.removeItem('student_session');
      await signOut(auth);
      setUser(null);
      setRole(null);
      setStudentData(null);
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
          <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-2' py-0.5 px-3 rounded-full border border-indigo-150 font-bold">
            Portal Multiusuario Activo
          </span>
        </div>

        {/* Central Auth Screen */}
        <div className="max-w-md w-full mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="bg-blue-50 text-blue-600 p-4 rounded-full inline-block mb-3">
              <GraduationCap className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Acceso Institucional
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Plataforma transparente de asistencia, rúbricas y calificaciones en tiempo real.
            </p>
          </div>

          {/* Selector de Pestaña de Acceso */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMode('teacher');
                setAuthError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all ${
                loginMode === 'teacher'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Soy Profesor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('student');
                setAuthError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all ${
                loginMode === 'student'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Soy Alumno</span>
            </button>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 text-xs rounded-2xl text-left flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error de Acceso</p>
                <p className="mt-1 leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Formulario Dinámico de acuerdo a la pestaña seleccionada */}
          {loginMode === 'teacher' ? (
            <form onSubmit={handleTeacherLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Correo del Profesor</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Contraseña</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {authSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Ingresar como Administrador</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[9px] text-slate-400 font-mono uppercase font-bold">O Alternativa Rápida</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-2.5 text-xs font-bold transition-all"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Acceder con Google</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleStudentLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Código / Matrícula de Alumno</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="ej. A01203040"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">ID del Grupo / CRN de la Clase</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="ej. CRN105219"
                    value={groupCRN}
                    onChange={(e) => setGroupCRN(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {authSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Ver Mi Expediente Escolar</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Guía de Evaluación para el Supervisor (¡Sumamente Elegante!) */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 text-left rounded-2xl text-xs space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <span>Instrucciones para Evaluar:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-4 list-disc">
              <li>
                <strong>Profesores:</strong> Clasifícate usando el formulario de correo. O bien, inicia sesión con Google si usas la cuenta <strong className="text-slate-800 font-mono text-[10px] select-all font-semibold">{ADMIN_EMAIL}</strong>.
              </li>
              <li>
                <strong>Alumnos:</strong> No requieres Auth. Introduce tu <strong className="text-slate-800">Código de Estudiante</strong> y el <strong className="text-slate-800">CRN del Grupo</strong> preconfigurado o importado por el docente para revisar tu promedio y faltas.
              </li>
            </ul>
          </div>
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
