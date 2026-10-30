import { notFound } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { getStudentBulletin } from '@/lib/school/services/bulletins';

type Props = { params: Promise<{ studentId: string }> };

export default async function PrintableBulletinPage({ params }: Props) {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrFamily(ctx.appRole)) notFound();

  const { studentId } = await params;
  const data = await getStudentBulletin(studentId);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-6 bg-white p-8 text-black print:max-w-none print:p-0">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">ESMT - Bulletin Academique</h1>
        <p className="text-sm">Eleve: {data.student.firstName} {data.student.lastName} ({data.student.matricule})</p>
        <p className="text-sm">Annee: {data.enrollment?.academicYear ?? '-'}</p>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <div className="rounded border p-3"><p className="text-xs">Moyenne generale</p><p className="text-xl font-bold">{data.metrics.globalAverageOn20}/20</p></div>
        <div className="rounded border p-3"><p className="text-xs">Absences</p><p className="text-xl font-bold">{data.metrics.absencesCount}</p></div>
        <div className="rounded border p-3"><p className="text-xs">Non justifiees</p><p className="text-xl font-bold">{data.metrics.unjustifiedAbsences}</p></div>
      </section>

      <section className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100"><tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Matiere</th><th className="p-2 text-left">Moyenne /20</th></tr></thead>
          <tbody>
            {data.subjectAverages.map((s) => (
              <tr key={s.subjectCode} className="border-t"><td className="p-2">{s.subjectCode}</td><td className="p-2">{s.subjectName}</td><td className="p-2">{s.averageOn20}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="print:hidden text-sm text-muted-foreground">
        Utilisez la commande d'impression du navigateur (Ctrl+P) pour exporter ce bulletin en PDF.
      </p>
    </main>
  );
}
