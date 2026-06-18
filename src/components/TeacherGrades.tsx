import { useState, useEffect, FormEvent } from 'react';
import { db } from '../config/firebase';
import { collection, doc, getDocs, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  BookOpen, 
  RefreshCw, 
  Award,
  Users,
  Search,
  ChevronDown
} from 'lucide-react';
import { Group, Student, RubricCriterion } from '../types';

interface TeacherGradesProps {
  user: {
    uid: string;
  };
}

interface GradeItem {
  id: string; // Unique evaluation ID
  name: string; // e.g. "Examen Parcial 1"
  criterionId: string; // e.g. "tareas", "examenes"
  maxPoints: number; // e.g. 100
  createdAt: string;
}

interface StudentGradeReport {
  studentEmail: string;
  groupId: string;
  scores: { [gradeItemId: string]: number }; // e.g. { "exam1": 85 }
  criterionAverages: { [criterionId: string]: number };
  finalGrade: number;
  status: 'Aprobado' | 'Reprobado' | 'Sin derecho por faltas' | 'Sin calificar';
}

export default function TeacherGrades({ user }: TeacherGradesProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [selectedGradeItemId, setSelectedGradeItemId] = useState('');

  // Formulario de Nueva Evaluación
  const [newItemName, setNewItemName] = useState('');
  const [newItemCriterionId, setNewItemCriterionId] = useState('');
  const [newItemMaxPoints, setNewItemMaxPoints] = useState(100);

  // Calificaciones temporales en captura
  const [gradesInput, setGradesInput] = useState<{ [studentEmail: string]: number }>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evalSaving, setEvalSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // 2. Cargar evaluaciones (GradeItems), alumnos del grupo y sus calificaciones al cambiar de grupo o de evaluación
  useEffect(() => {
    if (!selectedGroupId) return;

    const group = groups.find(g => g.id === selectedGroupId) || null;
    setSelectedGroup(group);

    // Ajustar criterio predeterminado en el dropdown de nueva evaluación
    if (group && Object.keys(group.rubric).length > 0) {
      setNewItemCriterionId(Object.keys(group.rubric)[0]);
    }

    const loadData = async () => {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      
      try {
        // A. Cargar estudiantes del grupo
        const stSnap = await getDocs(collection(db, 'students'));
        const groupStudents: Student[] = [];
        stSnap.forEach((doc) => {
          const data = doc.data() as Student;
          if (data.groupId === selectedGroupId) {
            groupStudents.push({ ...data, email: doc.id });
          }
        });
        setStudents(groupStudents);

        // B. Cargar evaluaciones (Grade Items) de este grupo
        const itemsSnap = await getDocs(collection(db, 'groups', selectedGroupId, 'grade_items'));
        const itemsList: GradeItem[] = [];
        itemsSnap.forEach((d) => {
          itemsList.push(d.data() as GradeItem);
        });
        setGradeItems(itemsList);

        if (itemsList.length > 0) {
          // Seleccionar el primero por defecto si no hay ninguno seleccionado
          setSelectedGradeItemId(itemsList[0].id);
        } else {
          setSelectedGradeItemId('');
          setGradesInput({});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedGroupId, groups]);

  // Cargar calificaciones grabadas cuando cambia la evaluación seleccionada
  useEffect(() => {
    if (!selectedGroupId || !selectedGradeItemId) {
      setGradesInput({});
      return;
    }

    const loadScores = async () => {
      try {
        const inputMap: { [email: string]: number } = {};
        
        // Inicializar con 0 para todos
        students.forEach(st => {
          inputMap[st.email] = 0;
        });

        // Buscar reportes guardados de cada estudiante en subcolección 'student_grades'
        for (const student of students) {
          const sGradeRef = doc(db, 'groups', selectedGroupId, 'student_grades', student.email);
          const sGradeSnap = await getDoc(sGradeRef);
          if (sGradeSnap.exists()) {
            const gradeData = sGradeSnap.data() as StudentGradeReport;
            if (gradeData.scores && gradeData.scores[selectedGradeItemId] !== undefined) {
              inputMap[student.email] = gradeData.scores[selectedGradeItemId];
            }
          }
        }

        setGradesInput(inputMap);
      } catch (err) {
        console.error("Error cargando calificaciones del item:", err);
      }
    };

    loadScores();
  }, [selectedGradeItemId, selectedGroupId, students]);

  // 3. Crear nueva evaluación
  const handleCreateGradeItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = newItemName.trim();
    if (!cleanName || !newItemCriterionId) {
      setErrorMsg("Completa el nombre de la evaluación y el criterio de vinculación.");
      return;
    }

    setEvalSaving(true);
    try {
      const itemId = 'eval_' + Math.random().toString(36).substring(2, 9);
      const newItem: GradeItem = {
        id: itemId,
        name: cleanName,
        criterionId: newItemCriterionId,
        maxPoints: newItemMaxPoints || 100,
        createdAt: new Date().toISOString()
      };

      // Guardar evaluación en la subcolección de Firestore `/groups/{groupId}/grade_items/{itemId}`
      await setDoc(doc(db, 'groups', selectedGroupId, 'grade_items', itemId), newItem);

      setSuccessMsg(`Evaluación "${cleanName}" creada con éxito.`);
      setNewItemName('');
      
      // Actualizar vista local de evaluaciones
      setGradeItems([...gradeItems, newItem]);
      setSelectedGradeItemId(itemId);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al crear evaluación: ${err.message || err}`);
    } finally {
      setEvalSaving(false);
    }
  };

  // Manejar cambio de input en la tabla de calificaciones
  const handleGradeChange = (email: string, value: string) => {
    const num = Number(value) || 0;
    // Forzar entre 0 y el valor máximo de la evaluación
    const currentItem = gradeItems.find(item => item.id === selectedGradeItemId);
    const max = currentItem ? currentItem.maxPoints : 100;
    const cleanNum = Math.min(Math.max(num, 0), max);

    setGradesInput(prev => ({
      ...prev,
      [email]: cleanNum
    }));
  };

  // Rellenar todas las notas de los alumnos con un valor por defecto (ej. 100 o 0)
  const handleBulkFill = (value: number) => {
    const fresh: { [email: string]: number } = {};
    students.forEach(st => {
      fresh[st.email] = value;
    });
    setGradesInput(fresh);
  };

  // 4. Guardar calificaciones y ejecutar recálculo consolidado
  const handleSaveGrades = async () => {
    if (!selectedGroupId || !selectedGradeItemId) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const batch = writeBatch(db);
      const currentItem = gradeItems.find(it => it.id === selectedGradeItemId)!;

      // 1. Iterar sobre todos los alumnos para guardar sus puntuaciones y recalcular su ponderación final
      for (const student of students) {
        const studentGradesRef = doc(db, 'groups', selectedGroupId, 'student_grades', student.email);
        const stGradesSnap = await getDoc(studentGradesRef);

        let previousReport: StudentGradeReport = {
          studentEmail: student.email,
          groupId: selectedGroupId,
          scores: {},
          criterionAverages: {},
          finalGrade: 0,
          status: 'Sin calificar'
        };

        if (stGradesSnap.exists()) {
          previousReport = stGradesSnap.data() as StudentGradeReport;
        }

        // Actualizar la nota de la evaluación seleccionada actual
        const updatedScores = {
          ...(previousReport.scores || {}),
          [selectedGradeItemId]: gradesInput[student.email] ?? 0
        };

        // Recalcular el promedio de cada criterio de rúbrica
        const criterionSums: { [critId: string]: number } = {};
        const criterionCounts: { [critId: string]: number } = {};

        // Inicializar con ceros todos los criterios configurados del grupo
        if (selectedGroup) {
          Object.keys(selectedGroup.rubric).forEach(cId => {
            criterionSums[cId] = 0;
            criterionCounts[cId] = 0;
          });
        }

        // Recorrer todas las evaluaciones creadas y agruparlas por su criterio
        gradeItems.forEach(item => {
          const score = updatedScores[item.id];
          if (score !== undefined) {
            // Convertir la calificación a base 100 en caso de que maxPoints cambien
            const scoreOutOf100 = (score / item.maxPoints) * 100;
            criterionSums[item.criterionId] = (criterionSums[item.criterionId] || 0) + scoreOutOf100;
            criterionCounts[item.criterionId] = (criterionCounts[item.criterionId] || 0) + 1;
          }
        });

        // Calcular promedios finales evaluatorios de cada criterio
        const computedAverages: { [critId: string]: number } = {};
        let weightedFinalGradeSum = 0;

        if (selectedGroup) {
          Object.entries(selectedGroup.rubric).forEach(([cId, critEntry]) => {
            const criterion = critEntry as any;
            const count = criterionCounts[cId] || 0;
            const avg = count > 0 ? criterionSums[cId] / count : 100; // Si no hay tareas en un rubro, otorgar 100% de inicio o dejarlo neutro. Usaremos el promedio de lo evaluado.
            computedAverages[cId] = Math.round(avg);
            
            // Suma ponderada: Promedio * Porcentaje_Peso
            weightedFinalGradeSum += (avg * (criterion.percentage / 100));
          });
        }

        const finalGrade = Math.round(weightedFinalGradeSum);

        // Validar estatus general (tomando en cuenta el % de asistencia guardado en el documento del estudiante)
        const attendancePct = student.attendancePercentage ?? 100;

        let finalStatus: 'Aprobado' | 'Reprobado' | 'Sin derecho por faltas' = 'Aprobado';
        if (attendancePct < 80) {
          finalStatus = 'Sin derecho por faltas';
        } else if (finalGrade < 60) {
          finalStatus = 'Reprobado';
        }

        // Preparar reporte unificado
        const updatedReport: StudentGradeReport = {
          studentEmail: student.email,
          groupId: selectedGroupId,
          scores: updatedScores,
          criterionAverages: computedAverages,
          finalGrade,
          status: finalStatus
        };

        // Guardar en Firestore del grupo
        batch.set(studentGradesRef, updatedReport);

        // Trascendental: Sincronizar en tiempo real con la colección principal global del estudiante
        const globalStudentRef = doc(db, 'students', student.email);
        batch.update(globalStudentRef, {
          finalGrade,
          status: finalStatus
        });
      }

      await batch.commit();
      setSuccessMsg(`¡Calificaciones de "${currentItem.name}" registradas con éxito! Las notas ponderadas totales y estados reglamentarios se han guardado globalmente.`);
      
      // Recargar base de datos local para repulido de interfaz
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
      setErrorMsg(`Error al consolidar calificaciones: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(st =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario: Crear una nueva evaluación */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit">
          <div className="mb-4">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              Nueva Evaluación
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Define un examen, proyecto u tarea vinculada a la rúbrica.</p>
          </div>

          <form onSubmit={handleCreateGradeItem} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Nombre del Rubro/Evaluación</label>
              <input
                type="text"
                required
                placeholder="ej. Tarea 1: Ecuaciones"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Criterio Relacionado</label>
              {selectedGroup ? (
                <select
                  value={newItemCriterionId}
                  onChange={(e) => setNewItemCriterionId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none bg-slate-50 font-bold"
                >
                  {Object.values(selectedGroup.rubric).map((crit: any) => (
                    <option key={crit.id} value={crit.id}>{crit.name} ({crit.percentage}%)</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400">Crea un grupo con rúbrica primero.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Puntuación de Base Máxima</label>
              <input
                type="number"
                min="10"
                max="100"
                value={newItemMaxPoints}
                onChange={(e) => setNewItemMaxPoints(Number(e.target.value) || 100)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={evalSaving || !selectedGroupId}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold py-2 rounded-xl text-xs transition-all border border-slate-200"
            >
              {evalSaving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Crear Item de Rúbrica</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sección de Registro Masivo */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-md font-extrabold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" />
                Matriz Evaluatoria de Alumnos
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Escribe las puntuaciones brutas de tus estudiantes. Convertimos y ponderamos sus calificaciones automáticamente.
              </p>
            </div>

            {/* Selector de Grupo */}
            <div className="min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Cambiar de Grupo</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full text-xs px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-xl font-bold text-slate-700"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.id} - {g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-mono">Consolidando estructura evaluatoria...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-sm font-semibold text-slate-600">No hay ningún alumno inscrito en este grupo.</p>
              <p className="text-xs text-slate-400 mt-1">Por favor complete la carga masiva en el módulo anterior para continuar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selección del Item Evaluatorio */}
              <div className="p-4 rounded-xl bg-indigo-50/20 border border-indigo-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-bold text-indigo-500 uppercase font-mono mb-1">
                    Selecciona Evaluación a Calificar
                  </label>
                  {gradeItems.length > 0 ? (
                    <select
                      value={selectedGradeItemId}
                      onChange={(e) => setSelectedGradeItemId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-indigo-200 bg-white rounded-xl font-black text-indigo-900"
                    >
                      {gradeItems.map(item => {
                        const crit = selectedGroup?.rubric[item.criterionId]?.name || 'Rúbrica';
                        return (
                          <option key={item.id} value={item.id}>
                            {item.name} - [{crit} (Max: {item.maxPoints} pts)]
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="text-xs font-semibold text-indigo-600">No has creado ningún item evaluatorio. Utilice el panel lateral.</p>
                  )}
                </div>

                {gradeItems.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleBulkFill(100)}
                      className="text-[10px] bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50"
                    >
                      Llenar con 100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkFill(0)}
                      className="text-[10px] bg-white text-red-600 border border-slate-200 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50"
                    >
                      Resetear a 0
                    </button>
                  </div>
                )}
              </div>

              {/* Barra de Búsqueda */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Filtrar por nombre o matrícula..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Mensajes de Validación */}
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-100 text-green-800 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Tabla responsiva para celular */}
              {gradeItems.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-inner max-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 text-slate-500 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Alumno</th>
                        <th className="py-2.5 px-3">Matrícula</th>
                        <th className="py-2.5 px-3 text-center">Asistencia Acumulada</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                        <th className="py-2.5 px-3 text-center w-32">Calificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredStudents.map(student => {
                        const currentItem = gradeItems.find(it => it.id === selectedGradeItemId);
                        const maxVal = currentItem ? currentItem.maxPoints : 100;
                        const gradeVal = gradesInput[student.email] ?? 0;

                        return (
                          <tr key={student.email} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <p className="font-bold text-slate-800 leading-none">{student.name}</p>
                              <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5 block">{student.email}</span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-600">{student.notes}</td>
                            <td className="py-2 px-3 text-center font-bold">
                              <span className={student.attendancePercentage && student.attendancePercentage < 80 ? "text-red-600" : "text-green-700"}>
                                {student.attendancePercentage ?? 100}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                student.status === 'Sin derecho por faltas'
                                  ? 'bg-red-100 text-red-800'
                                  : student.status === 'Reprobado'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {student.status || 'Aprobado'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxVal}
                                  value={gradeVal === 0 ? '' : gradeVal}
                                  onChange={(e) => handleGradeChange(student.email, e.target.value)}
                                  placeholder="0"
                                  className="w-16 text-center text-xs font-black font-mono border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white"
                                />
                                <span className="text-[10px] text-slate-400 font-mono">/ {maxVal}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center border border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs font-bold text-slate-500">Crea tu primer entregable en el panel de la izquierda para comenzar a calificar.</p>
                </div>
              )}

              {/* Botón de Confirmación Integral */}
              {gradeItems.length > 0 && (
                <div className="pt-4 border-t border-slate-150">
                  <button
                    onClick={handleSaveGrades}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Sincronizando ponderaciones en Firestore...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>Guardar Notas y Realizar Ponderación de Rúbrica</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
