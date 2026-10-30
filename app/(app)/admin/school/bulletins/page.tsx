'use client';

import { FormEvent, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Bulletin = {
  student: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    classroom?: { name: string; level: string; section?: string | null } | null;
  };
  enrollment: { academicYear: string; status: string } | null;
  metrics: {
    gradesCount: number;
    absencesCount: number;
    justifiedAbsences: number;
    unjustifiedAbsences: number;
    globalAverageOn20: number;
  };
  subjectAverages: { subjectCode: string; subjectName: string; averageOn20: number }[];
};

export default function SchoolBulletinsPage() {
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState<Bulletin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentId.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/school/bulletins/${encodeURIComponent(studentId.trim())}`, { cache: 'no-store' });
    if (!res.ok) {
      setReport(null);
      setError(res.status === 404 ? 'Eleve introuvable.' : 'Impossible de charger le bulletin.');
      setLoading(false);
      return;
    }
    const json = (await res.json()) as Bulletin;
    setReport(json);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulletin trimestriel</h1>
        <p className="text-muted-foreground">Consultez les moyennes par matiere et imprimez le bulletin.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche eleve</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex gap-3">
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ID eleve" />
            <Button type="submit" disabled={loading}>
              {loading ? 'Chargement...' : 'Generer'}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()} disabled={!report}>
              Imprimer / PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!report}
              onClick={() => {
                if (!report) return;
                window.open(`/admin/school/bulletins/${report.student.id}`, '_blank');
              }}
            >
              Vue impression pro
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {report.student.firstName} {report.student.lastName} - {report.student.matricule}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Classe: {report.student.classroom?.name ?? '-'} | Annee: {report.enrollment?.academicYear ?? '-'}
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Moyenne generale /20" value={report.metrics.globalAverageOn20} />
              <Stat label="Nombre de notes" value={report.metrics.gradesCount} />
              <Stat label="Absences justifiees" value={report.metrics.justifiedAbsences} />
              <Stat label="Absences non justifiees" value={report.metrics.unjustifiedAbsences} />
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Matiere</th>
                    <th className="p-2 text-left">Moyenne /20</th>
                  </tr>
                </thead>
                <tbody>
                  {report.subjectAverages.map((s) => (
                    <tr key={s.subjectCode} className="border-t">
                      <td className="p-2">{s.subjectCode}</td>
                      <td className="p-2">{s.subjectName}</td>
                      <td className="p-2">{s.averageOn20}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

