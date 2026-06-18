import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, getDocs, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Check, 
  Clock, 
  X, 
  Search, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Users
} from 'lucide-react';
import { Group, Student, AttendanceRecord, RubricCriterion } from '../types';

interface TeacherAttendanceProps {
  user: {
    uid: string;
  };
}

export default function TeacherAttendance({ user }: TeacherAttendanceProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [date, setDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [attendanceMap, setAttendanceMap] = useState<{ [studentEmail: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Cargar grupos del profesor
  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'groups'));
        const list: Group[] = [];
        snap.forEach((d) => {
          const g = d.data() as Group;
          if (g.teacherUid === user.uid) {
            list.push(g);
          }
        });
        setGroups(list);
        if (list.length > 0) {
          setSelectedGroupId(list[0].id);
        }
      } catch (err) {
        console.error("Error al leer grupos:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [user.uid]);

  // 2. Cargar estudiantes y asistencia existente cuando cambia el grupo o la fecha
  useEffect(() => {
    if (!selectedGroupId) return;
    
    const group = groups.find(g => g.id === selectedGroupId) || null;
    setSelectedGroup(group);

    const loadData = async () => {
      setLoading(true);
      setMessage(null);
      try {
        // Cargar todos los estudiantes de la colección global '/students' asignados a este groupId
        const stSnap = await getDocs(collection(db, 'students'));
        const groupStudents: Student[] = [];
        stSnap.forEach((doc) => {
          const data = doc.data() as Student;
          if (data.groupId === selectedGroupId) {
            groupStudents.push({ ...data, email: doc.id });
          }
        });
        setStudents(groupStudents);

        // Intentar leer si ya existe pase de lista para este día
        const attDocRef = doc(db, 'groups', selectedGroupId, 'attendance', date);
        const attSnap = await getDoc(attDocRef);

        const initialMap: { [email: string]: number } = {};
        
        // Poner estado predeterminado: "Asistencia (1.0)" para todos
        groupStudents.forEach(st => {
          initialMap[st.email] = 1.0;
        });

        if (attSnap.exists()) {
          const attData = attSnap.data() as AttendanceRecord;
          // Combinar con pase de lista guardado
          Object.entries(attData.records).forEach(([email, value]) => {
            initialMap[email] = value;
          });
          setMessage({ type: 'success', text: 'Pase de lista cargado desde el servidor.' });
        } else {
          setMessage({ type: 'success', text: 'Pase de lista nuevo. Todos marcados con Asistencia por defecto.' });
        }

        setAttendanceMap(initialMap);
      } catch (err: any) {
        console.error(err);
        setMessage({ type: 'error', text: `Error al cargar datos de asistencia: ${err.message || err}` });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedGroupId, date, groups]);

  // Marcar estado rápido
  const setStatus = (email: string, val: number) => {
    setAttendanceMap(prev => ({
      ...prev,
      [email]: val
    }));
  };

  // Función para guardar asistencia y calcular el estatus del alumno en base al motor de reglas del negocio
  const handleSaveAttendance = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    setMessage(null);

    try {
      // 1. Guardar el pase de lista de hoy en la subcolección interna del grupo
      const attendanceRef = doc(db, 'groups', selectedGroupId, 'attendance', date);
      const record: AttendanceRecord = {
        groupId: selectedGroupId,
        date,
        createdAt: new Date().toISOString(),
        records: attendanceMap
      };
      
      await setDoc(attendanceRef, record);

      // 2. Obtener todos los pases de lista históricos de este grupo para calcular inasistencias acumuladas
      const allAttSnap = await getDocs(collection(db, 'groups', selectedGroupId, 'attendance'));
      const attendanceHistory: AttendanceRecord[] = [];
      allAttSnap.forEach(d => {
        attendanceHistory.push(d.data() as AttendanceRecord);
      });

      const totalDays = attendanceHistory.length;

      // Usar transacciones/batch para actualizar a cada estudiante globalmente
      const batch = writeBatch(db);

      for (const student of students) {
        let studentAttendanceWeightSum = 0;

        // Sumar pesos del alumno para cada fecha evaluada
        attendanceHistory.forEach(attRecord => {
          const val = attRecord.records[student.email];
          // Si el alumno existe en ese pase de lista anterior
          if (val !== undefined) {
            studentAttendanceWeightSum += val;
          } else {
            // Si no estaba registrado ese día, asumimos asistencia completa para no perjudicarlo retroactivamente
            studentAttendanceWeightSum += 1.0;
          }
        });

        // % Asistencia = ((Asistencias_Completas + (Retardos * 0.5)) / Total_Dias) * 100
        const attendancePercentage = totalDays > 0 
          ? Math.round((studentAttendanceWeightSum / totalDays) * 100)
          : 100;

        // Recuperar registro de calificaciones del estudiante para conservar ponderación o actualizarla con el nuevo estatus
        const studentGradesRef = doc(db, 'groups', selectedGroupId, 'student_grades', student.email);
        const stGradesSnap = await getDoc(studentGradesRef);
        let finalGrade = student.finalGrade || 0;
        
        if (stGradesSnap.exists()) {
          finalGrade = stGradesSnap.data().finalGrade || 0;
        }

        // Reglas de negocio AUTOMÁTICAS:
        // - "Sin derecho por faltas": Si asistencia es menor al 80%. (Regla prioritaria).
        // - "Reprobado": Si tiene >= 80% asistencia pero promedio final es < 60.
        // - "Aprobado": Si tiene >= 80% asistencia y promedio final es >= 60.
        let calculatedStatus: 'Aprobado' | 'Reprobado' | 'Sin derecho por faltas' = 'Aprobado';
        if (attendancePercentage < 80) {
          calculatedStatus = 'Sin derecho por faltas';
        } else if (finalGrade < 60) {
          calculatedStatus = 'Reprobado';
        }

        // Actualizar colección global de estudiantes '/students/{email}' de forma óptima
        const globalStudentRef = doc(db, 'students', student.email);
        batch.update(globalStudentRef, {
          attendancePercentage,
          finalGrade,
          status: calculatedStatus
        });

        // Actualizar también en el consolidador de notas del grupo para reportes consistentes
        batch.update(studentGradesRef, {
          status: calculatedStatus
        });
      }

      await batch.commit();
      setMessage({ type: 'success', text: `¡Pase de lista para el día ${date} guardado con éxito! Los porcentajes de asistencia y el estatus reglamentario de todos los alumnos se reevaluaron en tiempo real.` });
      
      // Recargar lista local para repintado
      const stSnap = await getDocs(collection(db, 'students'));
      const groupStudents: Student[] = [];
      stSnap.forEach((doc) => {
        const data = doc.data() as Student;
        if (data.groupId === selectedGroupId) {
          groupStudents.push({ ...data, email: doc.id });
        }
      });
      setStudents(groupStudents);

    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Error al guardar pase de lista: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(st => 
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Pase de Lista Diario Táctil
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Marca el estado diario de tus estudiantes. Los cambios se recalculan instantáneamente.
          </p>
        </div>

        {/* Controles de Grupo y Fecha */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Materia/Grupo</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700 focus:outline-none"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.id} - {g.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Fecha de Registro</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-xs font-mono">Cargando base estudiantil de Firestore...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <p className="text-sm font-semibold text-slate-600">No hay ningún alumno inscrito en este grupo.</p>
          <p className="text-xs text-slate-400 mt-1">Dirígete a "Gestión de Grupos" para cargarlos mediante archivo .csv externo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Campo de búsqueda responsivo */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, código o correo de alumno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Estado de validación */}
          {message && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              message.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Vista móvil (Cards) / Desktop (Tabla) */}
          <div className="block sm:hidden space-y-3">
            {filteredStudents.map((student) => {
              const currentVal = attendanceMap[student.email] ?? 1.0;
              return (
                <div key={student.email} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{student.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
                        {student.notes}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Asistencia acumulada: {student.attendancePercentage ?? 100}%
                      </span>
                    </div>
                  </div>

                  {/* Tactile Control Panel */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setStatus(student.email, 1.0)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all duration-150 flex flex-col items-center justify-center gap-1 border ${
                        currentVal === 1.0 
                          ? 'bg-green-100 text-green-800 border-green-300 shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>Asistencia</span>
                    </button>
                    <button
                      onClick={() => setStatus(student.email, 0.5)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all duration-150 flex flex-col items-center justify-center gap-1 border ${
                        currentVal === 0.5 
                          ? 'bg-yellow-105 bg-yellow-100 text-yellow-800 border-yellow-300 shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      <span>Retardo</span>
                    </button>
                    <button
                      onClick={() => setStatus(student.email, 0.0)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all duration-150 flex flex-col items-center justify-center gap-1 border ${
                        currentVal === 0.0 
                          ? 'bg-red-100 text-red-800 border-red-300 shadow-sm' 
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <X className="h-4 w-4" />
                      <span>Falta</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vista Desktop (Tabla) */}
          <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold font-mono border-b border-slate-200">
                  <th className="py-3 px-4">Alumno</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4 text-center">Asistencia Acumulada</th>
                  <th className="py-3 px-4 text-center">Estatus Reglamentario</th>
                  <th className="py-3 px-4 text-center w-80">Registrar Hoy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const currentVal = attendanceMap[student.email] ?? 1.0;
                  const attPrec = student.attendancePercentage ?? 100;
                  
                  return (
                    <tr key={student.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{student.email}</p>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">{student.notes}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={`font-black ${attPrec < 80 ? 'text-red-600' : 'text-slate-800'}`}>
                          {attPrec}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          student.status === 'Sin derecho por faltas'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : student.status === 'Reprobado'
                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                            : 'bg-green-100 text-green-800 border-green-200'
                        }`}>
                          {student.status || 'Aprobado'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setStatus(student.email, 1.0)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentVal === 1.0 
                                ? 'bg-green-600 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Presente
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(student.email, 0.5)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentVal === 0.5 
                                ? 'bg-yellow-500 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Retardo
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(student.email, 0.0)}
                            className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                              currentVal === 0.0 
                                ? 'bg-red-600 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            Falta
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirm Guardar */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Sincronizando con Cloud Firestore de PrepMaster...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar e Iniciar Recálculo de Asistencias</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
