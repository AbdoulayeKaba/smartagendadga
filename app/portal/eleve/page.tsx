'use client';

import { FormEvent, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import QRCode from 'react-qr-code';

type StudentView = {
  student: { firstName: string; lastName: string; matricule: string };
  enrollment: { academicYear: string } | null;
  metrics: { globalAverageOn20: number; absencesCount: number; unjustifiedAbsences: number };
  subjectAverages: { subjectCode: string; subjectName: string; averageOn20: number }[];
};

export default function StudentPortalPage() {
  const [matricule, setMatricule] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [scanToken, setScanToken] = useState('');
  const [data, setData] = useState<StudentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/portal/student/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule, dateOfBirth }),
    });
    if (!res.ok) return setError('Identifiants invalides.');
    const json = await res.json();
    setToken(json.token);
    const me = await fetch('/api/portal/student/me', { headers: { Authorization: `Bearer ${json.token}` } });
    if (!me.ok) return setError('Impossible de charger les donnees.');
    setData(await me.json());
  }

  async function generateQrToken() {
    setError(null);
    const res = await fetch('/api/portal/student/qr-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule, dateOfBirth }),
    });
    if (!res.ok) return setError('Impossible de generer le QR token.');
    const json = await res.json();
    setQrToken(json.qrToken);
  }

  async function loginWithQr(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/portal/student/qr-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrToken: scanToken.trim() }),
    });
    if (!res.ok) return setError('QR token invalide ou expire.');
    const json = await res.json();
    setToken(json.token);
    const me = await fetch('/api/portal/student/me', { headers: { Authorization: `Bearer ${json.token}` } });
    if (!me.ok) return setError('Impossible de charger les donnees via QR.');
    setData(await me.json());
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Portail Eleve ESMT</h1>
      <Card>
        <CardHeader><CardTitle>Connexion</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={login}>
            <Input placeholder="Matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
            <FrenchDateField value={dateOfBirth} onChange={setDateOfBirth} placeholder="Date de naissance" />
            <Button type="submit">Acceder</Button>
          </form>
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={generateQrToken}>
              Generer QR token (2 min)
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          {token ? <p className="mt-2 text-xs text-muted-foreground">Session eleve active.</p> : null}
          {qrToken ? (
            <div className="mt-4 flex flex-col items-start gap-2">
              <div className="rounded bg-white p-2">
                <QRCode value={qrToken} size={128} />
              </div>
              <p className="max-w-full break-all text-xs text-muted-foreground">{qrToken}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Connexion via QR token</CardTitle></CardHeader>
        <CardContent>
          <form className="flex gap-3" onSubmit={loginWithQr}>
            <Input placeholder="Coller le QR token" value={scanToken} onChange={(e) => setScanToken(e.target.value)} />
            <Button type="submit">Se connecter avec QR</Button>
          </form>
        </CardContent>
      </Card>

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle>{data.student.firstName} {data.student.lastName} - {data.student.matricule}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Annee: {data.enrollment?.academicYear ?? '-'}</p>
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
