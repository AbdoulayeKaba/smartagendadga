import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

export async function getStudentBulletin(studentId: string) {
  const students = await prisma.$queryRaw<
    Array<{
      id: string;
      matricule: string;
      first_name: string;
      last_name: string;
      email: string | null;
      classroom_id: string | null;
      classroom_name: string | null;
      classroom_level: string | null;
      classroom_section: string | null;
    }>
  >(
    Prisma.sql`SELECT
      s.id, s.matricule, s.first_name, s.last_name, s.email,
      c.id AS classroom_id, c.name AS classroom_name, c.level AS classroom_level, c.section AS classroom_section
    FROM students s
    LEFT JOIN classrooms c ON c.id = s.classroom_id
    WHERE s.id = ${studentId}
    LIMIT 1`
  );
  const student = students[0];
  if (!student) return null;

  const grades = await prisma.$queryRaw<
    Array<{
      id: string;
      assessment_type: string;
      score: number;
      max_score: number;
      assessment_date: string;
      comment: string | null;
      subject_id: string;
      subject_code: string;
      subject_name: string;
      teacher_id: string;
      teacher_first_name: string;
      teacher_last_name: string;
      ay_id: string;
      ay_label: string;
    }>
  >(
    Prisma.sql`SELECT
      g.id, g.assessment_type, g.score, g.max_score, g.assessment_date, g.comment,
      s.id AS subject_id, s.code AS subject_code, s.name AS subject_name,
      t.id AS teacher_id, t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
      ay.id AS ay_id, ay.label AS ay_label
    FROM grade_records g
    INNER JOIN subjects s ON s.id = g.subject_id
    INNER JOIN teachers t ON t.id = g.teacher_id
    INNER JOIN academic_years ay ON ay.id = g.academic_year_id
    WHERE g.student_id = ${studentId}
    ORDER BY g.assessment_date DESC`
  );

  const absences = await prisma.$queryRaw<
    Array<{
      id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
      status: string;
      reason: string | null;
      ay_id: string;
      ay_label: string;
      subject_name: string | null;
    }>
  >(
    Prisma.sql`SELECT
      a.id, a.date, a.start_time, a.end_time, a.status, a.reason,
      ay.id AS ay_id, ay.label AS ay_label, sub.name AS subject_name
    FROM student_absences a
    INNER JOIN academic_years ay ON ay.id = a.academic_year_id
    LEFT JOIN teacher_assignments ta ON ta.id = a.assignment_id
    LEFT JOIN subjects sub ON sub.id = ta.subject_id
    WHERE a.student_id = ${studentId}
    ORDER BY a.date DESC`
  );

  const enrollments = await prisma.$queryRaw<Array<{ id: string; status: string; academic_year_label: string }>>(
    Prisma.sql`SELECT se.id, se.status, ay.label AS academic_year_label
               FROM student_enrollments se
               INNER JOIN academic_years ay ON ay.id = se.academic_year_id
               WHERE se.student_id = ${studentId}
               ORDER BY se.enrolled_at DESC
               LIMIT 1`
  );
  const parents = await prisma.$queryRaw<
    Array<{ parent_id: string; first_name: string; last_name: string; email: string | null; relation: string | null }>
  >(
    Prisma.sql`SELECT p.id AS parent_id, p.first_name, p.last_name, p.email, sp.relation
               FROM student_parents sp
               INNER JOIN parents p ON p.id = sp.parent_id
               WHERE sp.student_id = ${studentId}`
  );

  const scoreRates = grades.map((g) => (g.max_score > 0 ? (g.score / g.max_score) * 20 : 0));
  const globalAverage = avg(scoreRates);
  const bySubject = new Map<string, { subjectCode: string; subjectName: string; values: number[] }>();
  for (const g of grades) {
    const rate = g.max_score > 0 ? (g.score / g.max_score) * 20 : 0;
    if (!bySubject.has(g.subject_id)) {
      bySubject.set(g.subject_id, { subjectCode: g.subject_code, subjectName: g.subject_name, values: [] });
    }
    bySubject.get(g.subject_id)?.values.push(rate);
  }
  const subjectAverages = Array.from(bySubject.values()).map((s) => ({
    subjectCode: s.subjectCode,
    subjectName: s.subjectName,
    averageOn20: avg(s.values),
  }));

  const justified = absences.filter((a) => a.status === 'justified').length;
  const enrollment = enrollments[0] ?? null;

  return {
    student: {
      id: student.id,
      matricule: student.matricule,
      firstName: student.first_name,
      lastName: student.last_name,
      email: student.email,
      classroom: student.classroom_id
        ? { id: student.classroom_id, name: student.classroom_name, level: student.classroom_level, section: student.classroom_section }
        : null,
      parents: parents.map((p) => ({
        id: p.parent_id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        relation: p.relation,
      })),
    },
    enrollment: enrollment ? { id: enrollment.id, status: enrollment.status, academicYear: enrollment.academic_year_label } : null,
    metrics: {
      gradesCount: grades.length,
      absencesCount: absences.length,
      justifiedAbsences: justified,
      unjustifiedAbsences: absences.filter((a) => a.status === 'unjustified').length,
      globalAverageOn20: globalAverage,
    },
    subjectAverages,
    grades: grades.map((g) => ({
      id: g.id,
      assessmentType: g.assessment_type,
      score: g.score,
      maxScore: g.max_score,
      scoreOn20: g.max_score > 0 ? Number(((g.score / g.max_score) * 20).toFixed(2)) : 0,
      date: g.assessment_date,
      comment: g.comment,
      subject: { id: g.subject_id, code: g.subject_code, name: g.subject_name },
      teacher: { id: g.teacher_id, firstName: g.teacher_first_name, lastName: g.teacher_last_name },
      academicYear: { id: g.ay_id, label: g.ay_label },
    })),
    absences: absences.map((a) => ({
      id: a.id,
      date: a.date,
      startTime: a.start_time,
      endTime: a.end_time,
      status: a.status,
      reason: a.reason,
      subject: a.subject_name,
      academicYear: { id: a.ay_id, label: a.ay_label },
    })),
  };
}

