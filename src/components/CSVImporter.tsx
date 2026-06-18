import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { db } from '../config/firebase';
import { doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Student } from '../types';

interface CSVImporterProps {
  onSuccess: () => void;
  groupIdFilter?: string; // Si se carga dentro del contexto de un grupo específico
  groupsList: Array<{ id: string; name: string }>;
}

interface CSVRow {
  'Name'?: string;
  'Notes'?: string;
  'Group Membership'?: string;
  'E-mail 1 - Value'?: string;
  [key: string]: any;
}

export default function CSVImporter({ onSuccess, groupIdFilter, groupsList }: CSVImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedStudents, setParsedStudents] = useState<Student[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsedStudents([]);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          setErrorMsg("El archivo CSV está vacío o no se ha podido parsear.");
          return;
        }

        // Inspeccionar las cabeceras encontradas
        const headers = results.meta?.fields || [];
        const requiredFields = ['Name', 'Notes', 'Group Membership', 'E-mail 1 - Value'];
        const missingFields = requiredFields.filter(field => !headers.includes(field));

        if (missingFields.length > 0) {
          setErrorMsg(`Faltan las siguientes columnas requeridas exactas: ${missingFields.join(', ')}`);
          return;
        }

        const validStudents: Student[] = [];
        const errorsList: string[] = [];

        rows.forEach((row, idx) => {
          const name = row['Name']?.trim();
          const notes = row['Notes']?.trim();
          const groupMembership = row['Group Membership']?.trim();
          const email = row['E-mail 1 - Value']?.trim().toLowerCase();

          if (!name || !notes || !groupMembership || !email) {
            errorsList.push(`Fila ${idx + 2}: Datos incompletos (requiere Name, Notes, Group, Email).`);
            return;
          }

          // Si hay un filtro del grupo activo de carga
          if (groupIdFilter && groupMembership !== groupIdFilter) {
            // Ignorar o alertar
            return;
          }

          validStudents.push({
            email,
            name,
            notes,
            groupId: groupMembership,
            status: 'Sin calificar',
            finalGrade: 0,
            attendancePercentage: 100
          });
        });

        if (validStudents.length === 0) {
          setErrorMsg("No se encontraron registros de alumnos válidos para importar.");
          return;
        }

        setParsedStudents(validStudents);
        if (errorsList.length > 0) {
          setErrorMsg(`Se encontraron algunos errores que serán omitidos: ${errorsList.slice(0, 3).join(' | ')}...`);
        }
      },
      error: (err) => {
        setErrorMsg(`Error al parsear el CSV con PapaParse: ${err.message}`);
      }
    });
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const uploadToFirestore = async () => {
    if (parsedStudents.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const batch = writeBatch(db);

      // Usamos Firestore WriteBatch para realizar la escritura masiva de manera transaccional rápida
      for (const student of parsedStudents) {
        // Guardado directo en la colección global '/students' utilizando email como ID único (Requerimiento prioritario)
        const studentRef = doc(db, 'students', student.email);
        batch.set(studentRef, student);

        // Registro de calificaciones en blanco bajo el grupo
        const gradeRef = doc(db, 'groups', student.groupId, 'student_grades', student.email);
        batch.set(gradeRef, {
          studentEmail: student.email,
          groupId: student.groupId,
          scores: {},
          criterionAverages: {},
          finalGrade: 0,
          status: 'Sin calificar'
        });
      }

      await batch.commit();
      setSuccessMsg(`¡Carga masiva completada! Se han importado/actualizado con éxito ${parsedStudents.length} alumnos.`);
      setParsedStudents([]);
      setFileName(null);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al guardar lote en Firestore: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-md font-bold text-slate-800">Carga Masiva de Alumnos (CSV)</h3>
          <p className="text-xs text-slate-500">Mapea datos institucionales al instante usando PapaParse.</p>
        </div>
        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
          <Upload className="h-5 w-5" />
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50'
            : fileName
            ? 'border-emerald-500 bg-emerald-50/10'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />
        <FileSpreadsheet className={`h-8 w-8 mb-2 ${fileName ? 'text-emerald-500' : 'text-slate-400'}`} />
        {fileName ? (
          <div>
            <p className="text-sm font-semibold text-emerald-700">{fileName}</p>
            <p className="text-xs text-slate-500 mt-1">Haz clic o arrastra otro archivo para cambiar</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-slate-800">Arrastra tu archivo .csv aquí o haz clic para explorar</p>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">Columnas exactas requeridas: Name, Notes, Group Membership, E-mail 1 - Value</span>
          </div>
        )}
      </div>

      {/* Errores del validador */}
      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Correcto */}
      {successMsg && (
        <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-800 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabla responsiva temporal con previsualización para el Celular/Laptop */}
      {parsedStudents.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 font-mono uppercase">
              Previsualización ({parsedStudents.length} alumnos encontrados)
            </span>
            <button
              onClick={() => setParsedStudents([])}
              className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-semibold"
            >
              <Trash2 className="h-3 w-3" />
              <span>Limpiar</span>
            </button>
          </div>

          {/* Versión scrollable horizontal para no romper en Celular */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48 shadow-inner">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 sticky top-0">
                <tr>
                  <th className="p-2 border-b">Nombre</th>
                  <th className="p-2 border-b">Código/Matrícula</th>
                  <th className="p-2 border-b text-center">CRN Grupo</th>
                  <th className="p-2 border-b">Correo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedStudents.map((st, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-2 font-medium text-slate-800 whitespace-nowrap">{st.name}</td>
                    <td className="p-2 font-mono whitespace-nowrap">{st.notes}</td>
                    <td className="p-2 text-center font-bold text-blue-600 whitespace-nowrap">{st.groupId}</td>
                    <td className="p-2 font-mono whitespace-nowrap">{st.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={uploadToFirestore}
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-md"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Registrando en Firestore...</span>
              </>
            ) : (
              <span>Confirmar Carga Masiva a Firestore</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
