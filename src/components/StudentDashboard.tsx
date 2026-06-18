import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { 
  BookOpen, 
  Calendar, 
  Award, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Check, 
  X, 
  Clock, 
  FileText,
  Bookmark
} from 'lucide-react';
import { Student, Group } from '../types';

interface StudentDashboardProps {
  user: {
    displayName: string | null;
    email: string | null;
    uid: string;
  };
  studentData: Student | null;
  activeTab: string;
}

interface GradeItem {
  id: string;
  name: string;
  criterionId: string;
  maxPoints: number;
}

interface StudentGradeReport {
  studentEmail: string;
  groupId: string;
  scores: { [gradeItemId: string]: number };
  criterionAverages: { [criterionId: string]: number };
  finalGrade: number;
  status: string;
}

interface UserAttendanceLog {
  date: string;
  value: number; // 1.0 = Present, 0.5 = Tardy, 0.0 = Absent
}

export default function StudentDashboard({ user, studentData, activeTab }: StudentDashboardProps) {
  const [groupInfo, setGroupInfo] = useState<Group | null>(null);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [gradeReport, setGradeReport] = useState<StudentGradeReport | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<UserAttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  const attendance = studentData?.attendancePercentage ?? 100;
  const grade = studentData?.finalGrade ?? 0;
  const course = studentData?.groupId || "Sin Asignar";
  const notes = studentData?.notes || "Sin Matrícula";
  const studentEmail = studentData?.email || user.email || "";

  // Cuentas de asistencia del alumno para render resumido
  const totalClasses = attendanceLogs.length;
  const presentsCount = attendanceLogs.filter(log => log.value === 1.0).length;
  const tardiesCount = attendanceLogs.filter(log => log.value === 0.5).length;
  const absentsCount = attendanceLogs.filter(log => log.value === 0.0).length;

  useEffect(() => {
    if (!studentData?.groupId || !studentEmail) return;

    const fetchStudentTransparencyData = async () => {
      setLoading(true);
      try {
        const gId = studentData.groupId;
        
        // 1. Obtener información de la rúbrica del Grupo
        const gDoc = await getDoc(doc(db, 'groups', gId));
        if (gDoc.exists()) {
          setGroupInfo(gDoc.data() as Group);
        }

        // 2. Obtener los items evaluatorios (eval_xxx)
        const itemsSnap = await getDocs(collection(db, 'groups', gId, 'grade_items'));
        const items: GradeItem[] = [];
        itemsSnap.forEach(doc => {
          items.push(doc.data() as GradeItem);
        });
        setGradeItems(items);

        // 3. Obtener el reporte formal de calificaciones del alumno
        const rDoc = await getDoc(doc(db, 'groups', gId, 'student_grades', studentEmail));
        if (rDoc.exists()) {
          setGradeReport(rDoc.data() as StudentGradeReport);
        }

        // 4. Obtener todos los pases de asistencia y buscar los registros de este alumno
        const attSnap = await getDocs(collection(db, 'groups', gId, 'attendance'));
        const logs: UserAttendanceLog[] = [];
        attSnap.forEach(doc => {
          const data = doc.data();
          const records = data.records || {};
          if (records[studentEmail] !== undefined) {
            logs.push({
              date: doc.id, // YYYY-MM-DD
              value: records[studentEmail]
            });
          }
        });
        // Ordenar fechas de la más reciente a la más antigua
        logs.sort((a,b) => b.date.localeCompare(a.date));
        setAttendanceLogs(logs);

      } catch (err) {
        console.error("Error al cargar datos escolares de transparencia:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentTransparencyData();
  }, [studentData, studentEmail]);

  // Estatus de alumno calculado con las Reglas de Negocio Automáticas requeridas:
  let isNoRight = attendance < 80;
  let statusText = "Aprobado";
  let statusColor = "bg-green-100 text-green-800 border-green-200";
  let descriptionColor = "text-green-600";
  let Icon = CheckCircle;

  if (isNoRight) {
    statusText = "Sin derecho por faltas";
    statusColor = "bg-red-100 text-red-800 border-red-200";
    descriptionColor = "text-red-600";
    Icon = AlertTriangle;
  } else if (grade < 60) {
    statusText = "Reprobado";
    statusColor = "bg-orange-100 text-orange-800 border-orange-200";
    descriptionColor = "text-orange-600";
    Icon = AlertTriangle;
  } else {
    statusColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
    descriptionColor = "text-emerald-000 text-emerald-600";
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header Alumno */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 md:p-8 text-white shadow-lg mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-white font-mono text-xs px-3 py-1 rounded-full border border-white/10 font-medium tracking-wide">
              Panel de Transparencia de Alumno
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-2">
              ¡Hola, {studentData?.name || user.displayName}!
            </h1>
            <p className="text-indigo-100 text-xs md:text-sm mt-1">
              Aquí puedes revisar en tiempo real el desglose de tus calificaciones y el porcentaje de inasistencias registrado.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
            <div className="text-right">
              <p className="text-[10px] text-indigo-200 uppercase font-mono">Matrícula Escolar</p>
              <p className="text-sm font-semibold">{notes}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
          <p className="text-xs font-mono">Consultando historial académico en Firestore...</p>
        </div>
      ) : activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tarjeta de Estatus de Negocio */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">Estatus Académico</span>
                <Icon className={`h-5 w-5 ${descriptionColor}`} />
              </div>
              <div className="mt-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                  {statusText}
                </span>
              </div>
              <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                {isNoRight 
                  ? "Atención: Has acumulado un nivel de inasistencias mayor al 20%. De acuerdo con el reglamento escolar, has perdido los derechos evaluatorios."
                  : grade < 60 
                  ? "Actualmente tu promedio se encuentra por debajo del estándar aprobatorio de 60 puntos."
                  : "¡Felicidades! Mantienes un estatus regular aprobatorio. Sigue esforzándote."
                }
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-6">
              <span className="text-xs text-slate-400 font-mono">Reglas de negocio automáticas aplicadas</span>
            </div>
          </div>

          {/* Tarjeta de Asistencia */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">Porcentaje de Asistencia</span>
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-4xl font-extrabold tracking-tight ${attendance < 80 ? 'text-red-600' : 'text-slate-900'}`}>
                  {attendance}%
                </span>
                <span className="text-slate-400 text-xs">de asistencia</span>
              </div>
              
              {/* Barra de progreso */}
              <div className="w-full bg-slate-100 rounded-full h-2 mt-4">
                <div 
                  className={`h-2 rounded-full ${attendance < 80 ? 'bg-red-500' : 'bg-green-500'}`} 
                  style={{ width: `${attendance}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Límite mínimo requerido para conservar derecho a examen: <strong>80% de asistencia registrada</strong>.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between text-xs text-slate-500">
              <span>Clases evaluadas:</span>
              <span className="font-bold">{totalClasses} registradas</span>
            </div>
          </div>

          {/* Tarjeta de Calificaciones */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono tracking-wider text-slate-400 uppercase">Calificación Promedio</span>
                <Award className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {grade.toFixed(1)}
                </span>
                <span className="text-slate-400 text-xs">/ 100</span>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                Este promedio es el resultado ponderado de la rúbrica personalizada de tu grupo: <strong>{course}</strong>.
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between text-xs text-slate-500">
              <span>Estatus evaluatorio:</span>
              <span className="font-semibold text-slate-700">Actualizado en tiempo real</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'grades' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Desglose ponderado de Rúbrica */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-indigo-600" />
                Resumen de Rúbrica
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Pesos asignados por tu docente para la acreditación.</p>
            </div>

            <div className="space-y-4">
              {groupInfo && Object.values(groupInfo.rubric).length > 0 ? (
                Object.values(groupInfo.rubric).map((criterion: any) => {
                  const studentRawAvg = gradeReport?.criterionAverages?.[criterion.id] ?? 0;
                  const weightedContribution = ((studentRawAvg * criterion.percentage) / 100);
                  
                  return (
                    <div key={criterion.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between font-semibold text-xs text-slate-700 mb-1">
                        <span>{criterion.name}</span>
                        <span className="font-mono">{criterion.percentage}% del total</span>
                      </div>
                      
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-slate-800">{studentRawAvg}% <span className="text-[10px] text-slate-400 font-normal">promedio</span></span>
                        <span className="text-xs text-indigo-600 font-black">+{weightedContribution.toFixed(1)} pts</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">No hay configuraciones de rúbrica activas de momento.</p>
              )}
            </div>

            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between text-indigo-900">
              <span className="text-xs font-extrabold font-mono uppercase">Promedio Total Consolidado:</span>
              <span className="text-xl font-black font-mono">{grade}%</span>
            </div>
          </div>

          {/* Calificaciones Itemizadas */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Entregas y Evaluaciones Detalladas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Calificaciones brutas obtenidas en cada asignación registrada.</p>
            </div>

            {gradeItems.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs font-bold text-slate-400">Aún no se han evaluado tareas o exámenes oficiales para ti.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-55 bg-slate-50 font-bold font-mono text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Evaluación</th>
                      <th className="p-3">Criterio Rúbrica</th>
                      <th className="p-3 text-center">Calificación Bruta</th>
                      <th className="p-3 text-center">Porcentaje Equivalente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {gradeItems.map(item => {
                      const points = gradeReport?.scores?.[item.id] ?? 0;
                      const percentage = ((points / item.maxPoints) * 100);
                      const critName = groupInfo?.rubric[item.criterionId]?.name || 'Rúbrica';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="p-3 font-mono text-[10px] bg-slate-50/50 font-semibold">{critName}</td>
                          <td className="p-3 text-center font-bold font-mono">{points} / {item.maxPoints}</td>
                          <td className="p-3 text-center font-bold text-indigo-600 font-mono">{percentage.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : activeTab === 'attendance' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Métrica de inasistencias resumida */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Resumen de Asistencia
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Totales acumulados desde el primer día de clases.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-green-50 text-green-800 p-3 rounded-xl border border-green-100">
                <p className="text-[10px] text-green-600 font-mono uppercase font-bold">Asistencias</p>
                <p className="text-lg font-black mt-1 font-mono">{presentsCount}</p>
              </div>
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-100">
                <p className="text-[10px] text-yellow-600 font-mono uppercase font-bold">Retardos</p>
                <p className="text-lg font-black mt-1 font-mono">{tardiesCount}</p>
              </div>
              <div className="bg-red-50 text-red-800 p-3 rounded-xl border border-red-100">
                <p className="text-[10px] text-red-600 font-mono uppercase font-bold">Faltas</p>
                <p className="text-lg font-black mt-1 font-mono">{absentsCount}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              attendance < 80 
                ? 'bg-red-50 text-red-800 border-red-100' 
                : 'bg-green-50 text-green-800 border-green-100'
            }`}>
              <div>
                <p className="font-extrabold">Estatus de Admisión Escolar:</p>
                <p className="opacity-90 mt-0.5">
                  {attendance < 80 
                    ? 'No posees derecho a examinación de momento.' 
                    : 'Conservas todos tus derechos de evaluación vigentes.'
                  }
                </p>
              </div>
              <span className="text-xl font-black font-mono">{attendance}%</span>
            </div>
          </div>

          {/* Historial fecha por fecha */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Historial de Pase de Lista Diario
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Seguimiento cronológico transparente auditable.</p>
            </div>

            {attendanceLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs font-bold text-slate-400">No se registran pases de lista en este grupo aún.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-[360px] overflow-y-auto">
                <div className="divide-y divide-slate-150">
                  {attendanceLogs.map((log, i) => (
                    <div key={i} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {log.date}
                        </span>
                      </div>

                      <div>
                        {log.value === 1.0 ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200">
                            <Check className="h-3 w-3" />
                            <span>Presente</span>
                          </span>
                        ) : log.value === 0.5 ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-105 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200">
                            <Clock className="h-3 w-3" />
                            <span>Retardo (0.5)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">
                            <X className="h-3 w-3" />
                            <span>Falta</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 max-w-2xl mx-auto shadow-sm">
          <p className="text-sm text-slate-500">
            Pestaña no reconocida. Por favor regresa al panel principal.
          </p>
        </div>
      )}
    </div>
  );
}
