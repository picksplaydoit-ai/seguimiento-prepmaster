export type UserRole = 'teacher' | 'student' | null;

export interface RubricCriterion {
  id: string;
  name: string;
  percentage: number;
}

export interface GroupRubric {
  [criterionId: string]: RubricCriterion;
}

export interface Group {
  id: string; // ID único o CRN, por ejemplo 'CRN105219'
  name: string; // Nombre del grupo, por ejemplo 'Matemáticas Avanzadas I'
  teacherUid: string; // UID del profesor propietario
  createdAt: string;
  rubric: GroupRubric;
}

export interface Student {
  email: string; // ID del documento, correo institucional
  name: string; // Nombre completo del alumno
  notes: string; // Código o matrícula única del alumno, por ejemplo 'A01234567'
  groupId: string; // ID de grupo (CRN)
  status?: 'Aprobado' | 'Reprobado' | 'Sin derecho por faltas' | 'Sin calificar';
  finalGrade?: number;
  attendancePercentage?: number;
}

export interface AttendanceRecord {
  groupId: string;
  date: string; // Formato YYYY-MM-DD
  createdAt: string;
  records: {
    [studentEmail: string]: number; // 1.0 (Asistencia), 0.5 (Retardo), 0.0 (Falta)
  };
}

export interface GradeItem {
  id: string;
  name: string;
  criterionId: string; // ID de la rúbrica (ej. 'tareas', 'examenes')
  maxPoints: number; // Por ejemplo 100
  createdAt: string;
}

export interface StudentGrades {
  studentEmail: string;
  groupId: string;
  scores: {
    [gradeItemId: string]: number; // Puntuación de la actividad (0-100)
  };
  criterionAverages: {
    [criterionId: string]: number;
  };
  finalGrade: number;
  status: 'Aprobado' | 'Reprobado' | 'Sin derecho por faltas' | 'Sin calificar';
}
