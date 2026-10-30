'use client';

import { FormEvent, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ParentView = {
  parent: { first_name: string; last_name: string; email: string | null } | null;
  student: { firstName: string; lastName: string; matricule: string };
  metrics: { globalAverageOn20: number; absencesCount: number; unjustifiedAbsences: number };
  subjectAverages: { subjectCode: string; subjectName: string; averageOn20: number }[];
};

export default function ParentPortalPage() {
  const [studentMatricule, setStudentMatricule] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [data, setData] = useState<ParentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/portal/parent/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentMatricule, parentEmail }),
    });
    if (!res.ok) return setError('Acces refuse.');
    const json = await res.json();
    const me = await fetch('/api/portal/parent/me', { headers: { Authorization: `Bearer ${json.token}` } });
    if (!me.ok) return setError('Impossible de charger les donnees parent.');
    setData(await me.json());
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Portail Parent ESMT</h1>
      <Card>
        <CardHeader><CardTitle>Connexion parent</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={login}>
            <Input placeholder="Matricule eleve" value={studentMatricule} onChange={(e) => setStudentMatricule(e.target.value)} />
            <Input placeholder="Email parent" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            <Button type="submit">Acceder</Button>
          </form>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Parent: {data.parent?.first_name} {data.parent?.last_name} | Eleve: {data.student.firstName} {data.student.lastName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Moyenne generale: <strong>{data.metrics.globalAverageOn20}/20</strong></p>
            <p className="text-sm">Absences: {data.metrics.absencesCount} (non justifiees: {data.metrics.unjustifiedAbsences})</p>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Matiere</th><th className="p-2 text-left">Moyenne</th></tr></thead>
                <tbody>
                  {data.subjectAverages.map((s) => (
                    <tr key={s.subjectCode} className="border-t"><td className="p-2">{s.subjectCode}</td><td className="p-2">{s.subjectName}</td><td className="p-2">{s.averageOn20}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
