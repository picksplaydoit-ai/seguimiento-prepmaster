import { useState, useEffect, FormEvent } from 'react';
import { db } from '../config/firebase';
import { doc, setDoc, getDocs, collection, query, serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  BookOpen, 
  Settings, 
  RefreshCw, 
  Layers,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { Group, GroupRubric, RubricCriterion } from '../types';
import CSVImporter from './CSVImporter';

interface TeacherGroupsProps {
  user: {
    uid: string;
    email: string | null;
  };
}

export default function TeacherGroups({ user }: TeacherGroupsProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Campos del nuevo grupo
  const [groupId, setGroupId] = useState(''); // CRN
  const [groupName, setGroupName] = useState('');
  
  // Criterios dinámicos de rúbrica
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([
    { id: 'tareas', name: 'Tareas', percentage: 40 },
    { id: 'examenes', name: 'Exámenes', percentage: 40 },
    { id: 'proyecto', name: 'Proyecto Final', percentage: 20 }
  ]);

  const [activeImportGroupId, setActiveImportGroupId] = useState<string | null>(null);

  // Cargar grupos existentes de Firestore
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'groups'));
      const list: Group[] = [];
      snap.forEach((d) => {
        list.push(d.data() as Group);
      });
      setGroups(list);
    } catch (err) {
      console.error("Error al leer grupos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Agregar criterio de rúbrica vacío
  const handleAddCriterion = () => {
    const newId = 'crit_' + Math.random().toString(36).substring(2, 9);
    setRubricCriteria([
      ...rubricCriteria,
      { id: newId, name: '', percentage: 0 }
    ]);
  };

  // Remover criterio de rúbrica
  const handleRemoveCriterion = (id: string) => {
    setRubricCriteria(rubricCriteria.filter(c => c.id !== id));
  };

  // Actualizar campo de un criterio
  const handleUpdateCriterion = (id: string, field: 'name' | 'percentage', value: any) => {
    setRubricCriteria(rubricCriteria.map(c => {
      if (c.id === id) {
        if (field === 'percentage') {
          return { ...c, [field]: Number(value) || 0 };
        }
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  // Calcular la suma de porcentajes
  const totalPercentage = rubricCriteria.reduce((sum, c) => sum + c.percentage, 0);
  const isRubricValid = totalPercentage === 100;

  // Guardar grupo en Firestore
  const handleSaveGroup = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validar datos básicos
    const cleanId = groupId.trim().toUpperCase();
    const cleanName = groupName.trim();

    if (!cleanId || !cleanName) {
      setErrorMsg("El ID del Grupo (CRN) y el Nombre del Grupo son obligatorios.");
      return;
    }

    if (!isRubricValid) {
      setErrorMsg(`La rúbrica no es válida. La suma de los porcentajes debe ser exactamente 100% (Suma actual: ${totalPercentage}%).`);
      return;
    }

    // Validar nombres de criterios vacíos
    if (rubricCriteria.some(c => !c.name.trim())) {
      setErrorMsg("Todos los criterios de evaluación de la rúbrica deben tener un nombre asignado.");
      return;
    }

    setSaving(true);
    try {
      // Convertir lista de criterios en rubro/mapa para Firestore
      const rubricMap: GroupRubric = {};
      rubricCriteria.forEach(c => {
        rubricMap[c.id] = {
          id: c.id,
          name: c.name.trim(),
          percentage: c.percentage
        };
      });

      const newGroup: Group = {
        id: cleanId,
        name: cleanName,
        teacherUid: user.uid,
        createdAt: new Date().toISOString(),
        rubric: rubricMap
      };

      // Guardar en Firestore `/groups/{groupId}`
      await setDoc(doc(db, 'groups', cleanId), newGroup);

      setSuccessMsg(`¡Grupo "${cleanId} - ${cleanName}" guardado satisfactoriamente con su rúbrica del 100%!`);
      // Resetear formulario
      setGroupId('');
      setGroupName('');
      setRubricCriteria([
        { id: 'tareas', name: 'Tareas', percentage: 40 },
        { id: 'examenes', name: 'Exámenes', percentage: 40 },
        { id: 'proyecto', name: 'Proyecto Final', percentage: 20 }
      ]);
      
      // Recargar lista
      await fetchGroups();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al guardar el grupo: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Grid superior Formulario de Creación / Vista Rápida */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario de Creación de Grupos y Rúbrica */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Alta Dinámica de Grupo
            </h2>
            <p className="text-xs text-slate-500 mt-1">Crea un grupo de alumnos asignándole una rúbrica evaluatoria 100% personalizada.</p>
          </div>

          <form onSubmit={handleSaveGroup} className="space-y-6">
            {/* Campos básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  ID del Grupo / CRN
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. CRN105219"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nombre de la Asignatura
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Matemáticas Avanzadas I"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Rúbrica Personalizada */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Criterios de Evaluación</h3>
                  <p className="text-xs text-slate-400">La suma de los porcentajes debe dar exactamente 100%.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCriterion}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Añadir Criterio</span>
                </button>
              </div>

              {/* Lista de criterios editables */}
              <div className="space-y-3">
                {rubricCriteria.map((criterion, idx) => (
                  <div key={criterion.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 font-mono w-4">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Nombre del criterio (ej. Tareas)"
                      value={criterion.name}
                      onChange={(e) => handleUpdateCriterion(criterion.id, 'name', e.target.value)}
                      className="flex-grow text-sm bg-white px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required
                        placeholder="0"
                        value={criterion.percentage === 0 ? '' : criterion.percentage}
                        onChange={(e) => handleUpdateCriterion(criterion.id, 'percentage', e.target.value)}
                        className="w-full text-center text-sm font-bold bg-white px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-slate-500">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(criterion.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                      title="Eliminar criterio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Validador de Porcentaje Dinámico en Tiempo Real */}
              <div className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${
                isRubricValid 
                  ? 'bg-green-50 border-green-100 text-green-800' 
                  : 'bg-red-50/50 border-red-100 text-red-700'
              }`}>
                <div className="flex items-center gap-2.5">
                  {isRubricValid ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      Suma de Porcentajes: {totalPercentage}%
                    </p>
                    <p className="text-xs opacity-90">
                      {isRubricValid 
                        ? '¡Rúbrica válida al 100%! Listo para guardar.' 
                        : 'La sumatoria debe ser exactamente igual al 100% para poder habilitar el grupo.'
                      }
                    </p>
                  </div>
                </div>
                
                <span className={`text-lg font-black font-mono ${isRubricValid ? 'text-green-700' : 'text-red-600'}`}>
                  {totalPercentage}/100
                </span>
              </div>
            </div>

            {/* Alertas de error/éxito */}
            {errorMsg && (
              <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2 border border-red-100">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-green-50 text-green-800 rounded-xl text-xs flex items-start gap-2 border border-green-100">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Botón de guardar */}
            <button
              type="submit"
              disabled={saving || !isRubricValid}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Guardando Grupo en Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar Grupo y Rúbrica</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Listado de Grupos Existentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Grupos Activos
              </h3>
              <button onClick={fetchGroups} className="p-1 hover:bg-slate-50 rounded text-slate-500">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-xs font-mono">Buscando grupos en Cloud Firestore...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Sparkles className="h-8 w-8 text-blue-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No hay grupos creados</p>
                <p className="text-[10px] text-slate-400 mt-1 px-4">Utiliza el formulario de la izquierda para dar de alta tu primera materia institucional.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div key={group.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-bold font-mono tracking-wider">
                          {group.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(group.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight">
                        {group.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 leading-none">
                      <p className="text-[10px] font-bold text-slate-500 uppercase font-mono mb-2">Desglose de Rúbrica:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.values(group.rubric) as RubricCriterion[]).map((criterion) => (
                          <span key={criterion.id} className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-1 rounded font-medium">
                            {criterion.name}: <strong>{criterion.percentage}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveImportGroupId(activeImportGroupId === group.id ? null : group.id)}
                      className="mt-4 flex items-center justify-center gap-1.5 w-full bg-white text-slate-700 border border-slate-200 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all"
                    >
                      <Users className="h-3.5 w-3.5 text-blue-600" />
                      <span>{activeImportGroupId === group.id ? 'Ocultar Carga' : 'Cargar Alumnos (.csv)'}</span>
                    </button>
                    
                    {activeImportGroupId === group.id && (
                      <div className="mt-3 border-t border-slate-200/60 pt-3">
                        <CSVImporter 
                          groupsList={groups} 
                          groupIdFilter={group.id} 
                          onSuccess={() => {
                            setActiveImportGroupId(null);
                            fetchGroups();
                          }} 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-100 pt-4 mt-6">
            <span className="text-[10px] text-slate-400 font-mono">Reglas automáticas: Derecho evaluatorio ≥ 80% asistencia.</span>
          </div>
        </div>
      </div>

      {/* Carga Masiva Global de Alumnos */}
      {groups.length > 0 && !activeImportGroupId && (
        <div className="border-t border-slate-200 pt-8">
          <div className="max-w-3xl mx-auto">
            <CSVImporter 
              groupsList={groups} 
              onSuccess={() => {
                fetchGroups();
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
