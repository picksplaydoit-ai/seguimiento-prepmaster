import { useState, useEffect, FormEvent } from 'react';
import { db } from '../config/firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { Users, Plus, CheckCircle, GraduationCap, AlertTriangle, ArrowRight, UserPlus } from 'lucide-react';
import { Student } from '../types';
import TeacherGroups from './TeacherGroups';
import TeacherAttendance from './TeacherAttendance';
import TeacherGrades from './TeacherGrades';

interface TeacherDashboardProps {
  user: {
    displayName: string | null;
    email: string | null;
    uid: string;
  };
  activeTab: string;
}

export default function TeacherDashboard({ user, activeTab }: TeacherDashboardProps) {
  // Estado local para simular la creación de alumnos para pruebas de inicio de sesión
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testNotes, setTestNotes] = useState('');
  const [testGroup, setTestGroup] = useState('CRN105219');
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [registeredStudentsCount, setRegisteredStudentsCount] = useState(0);

  // Cargar contador de alumnos reales para retroalimentación
  const fetchStudentsCount = async () => {
    try {
      const snap = await getDocs(collection(db, 'students'));
      setRegisteredStudentsCount(snap.size);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStudentsCount();
  }, []);

  const handleCreateTestStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testName || !testNotes || !testGroup) {
      setErrorMsg('Por favor llena todos los campos.');
      return;
    }

    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // 1. Guardar en la colección global '/students' utilizando el email del alumno como Document ID
      const cleanedEmail = testEmail.trim().toLowerCase();
      const studentDocRef = doc(db, 'students', cleanedEmail);
      
      const newStudent: Student = {
        email: cleanedEmail,
        name: testName.trim(),
        notes: testNotes.trim(),
        groupId: testGroup.trim(),
        status: 'Sin calificar',
        finalGrade: 0,
        attendancePercentage: 100
      };

      await setDoc(studentDocRef, newStudent);
      
      // 2. Opcional: Registrar también en la subcolección interna del grupo para consistencia futura
      const groupStudentDocRef = doc(db, 'groups', testGroup.trim(), 'student_grades', cleanedEmail);
      await setDoc(groupStudentDocRef, {
        studentEmail: cleanedEmail,
        groupId: testGroup.trim(),
        scores: {},
        criterionAverages: {},
        finalGrade: 0,
        status: 'Sin calificar'
      });

      setSuccessMsg(`¡Alumno registrado con éxito! Ahora puedes iniciar sesión con la cuenta de Google correspondiente a "${cleanedEmail}" para visualizar el Dashboard de Alumno.`);
      setTestEmail('');
      setTestName('');
      setTestNotes('');
      fetchStudentsCount();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al guardar en Firestore: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const autofillWithMyEmail = () => {
    if (user.email) {
      setTestEmail(user.email);
      setTestName(user.displayName || 'Alumno de Prueba');
      setTestNotes('ALUMNO-TEST-001');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden mb-8">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
          <GraduationCap className="h-96 w-96" />
        </div>
        <div className="relative z-10">
          <span className="bg-blue-500/20 text-blue-300 font-mono text-xs px-3 py-1 rounded-full border border-blue-400/20 font-medium">
            Panel de Docente
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-3">
            ¡Hola, {user.displayName || 'Profesor'}!
          </h1>
          <p className="text-slate-300 mt-2 text-sm md:text-base max-w-2xl">
            Bienvenido al panel escolar de <strong>Seguimiento PrepMaster</strong>. Desde aquí gestionarás la asistencia diaria, las rúbricas personalizadas de tus materias y mantendrás la transparencia escolar de tus alumnos.
          </p>
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <p className="text-xs text-slate-400 uppercase font-mono">Profesor Activo</p>
              <p className="text-sm font-semibold">{user.email}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <p className="text-xs text-slate-400 uppercase font-mono">Alumnos Registrados</p>
              <p className="text-sm font-semibold">{registeredStudentsCount} estudiantes</p>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main info card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Seguimiento PrepMaster - Panel Escolar
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Actualmente te encuentras en el panel de control docente institucional. Aquí puedes simular de manera inmediata el registro de tus alumnos, habilitar sus accesos, y probar los flujos transparentes.
              </p>
              <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 font-sans">
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase">Habilitado en este módulo:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-semibold">✓</span>
                    <span><strong>Autenticación con Google</strong>: Inicio de sesión inmediato desde cualquier dispositivo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-semibold">✓</span>
                    <span><strong>Asignación Dinámica de Grupos</strong>: Crea materias, rúbricas al 100% y visualízalas en tiempo real en la siguiente pestaña.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-semibold">✓</span>
                    <span><strong>Carga Masiva con CSV</strong>: Procesa archivos de alumnos al instante mediante PapaParse.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Módulos de Gestión */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Accesos Directos del Profesor
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Usa el menú de navegación superior o móvil para ingresar a la gestión avanzada de rúbricas.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-800">Alta de Grupos</p>
                  <p className="text-xs text-slate-500 mt-1">Configura materias, CRN y rúbricas evaluatorias.</p>
                </div>
                <div className="border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-800">Carga Masiva (CSV)</p>
                  <p className="text-xs text-slate-500 mt-1">Utiliza archivos de texto plano para importar decenas de alumnos.</p>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULATOR TOOL - CRITICAL FOR SUPERVISOR EVALUATION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Simulador del Registro Institucional
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              La plataforma rechaza correos institucionales no registrados. Para probar el inicio de sesión como <strong>Alumno</strong>, registra una dirección de correo válida usando este formulario:
            </p>

            <form onSubmit={handleCreateTestStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Correo Electrónico a Permitir
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    required
                    placeholder="ejemplo@institucion.com"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={autofillWithMyEmail}
                    className="absolute right-2 top-1.5 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition-all"
                    title="Autocompletar con tu correo de docente para probar el flujo de alumno"
                  >
                    Usar mi correo
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Puedes registrar tu propio correo temporalmente para probar cómo lo vería un alumno.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  required
                  placeholder="Juan Pérez García"
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Código/Matrícula
                  </label>
                  <input
                    type="text"
                    value={testNotes}
                    onChange={(e) => setTestNotes(e.target.value)}
                    required
                    placeholder="A01203040"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Grupo ID (CRN)
                  </label>
                  <input
                    type="text"
                    value={testGroup}
                    onChange={(e) => setTestGroup(e.target.value)}
                    required
                    placeholder="CRN105219"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2.5 border border-red-100">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-green-50 text-green-800 rounded-xl text-xs flex items-start gap-2.5 border border-green-100">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Habilitar Acceso Alumno'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === 'groups' ? (
        <TeacherGroups user={user} />
      ) : activeTab === 'attendance' ? (
        <TeacherAttendance user={user} />
      ) : activeTab === 'grades' ? (
        <TeacherGrades user={user} />
      ) : (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 max-w-2xl mx-auto shadow-sm">
          <div className="bg-blue-50 text-blue-600 inline-flex p-4 rounded-full mb-4">
            <Plus className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Sección en Construcción (Próximo Paso)</h2>
          <p className="text-sm text-slate-500 mt-2">
            La vista para la pestaña "{activeTab}" será programada en los siguientes pasos para configurar la asignación real de calificaciones y la asistencia diaria mediante el pase de lista táctil. No obstante, tu panel de autenticación y de grupos ya está 100% activo.
          </p>
        </div>
      )}
    </div>
  );
}
