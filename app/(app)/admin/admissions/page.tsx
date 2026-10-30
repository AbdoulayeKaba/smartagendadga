'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/app-context';
import { formatDateTimeIntl } from '@/lib/datetime';
import { toast } from '@/hooks/use-toast';

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  submittedAt: string;
  academicYear: string;
};

const statusLabel: Record<string, string> = {
  submitted: 'Soumis',
  under_review: 'En revue',
  validated: 'Valide',
  rejected: 'Rejete',
  revision_required: 'A corriger',
  draft: 'Brouillon',
};

export default function AdminAdmissionsPage() {
  const { language } = useApp();
  const [loading, setLoading] = useState(true);
  const [preRegs, setPreRegs] = useState<Row[]>([]);
  const [apps, setApps] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch('/api/admissions/preregistrations', { credentials: 'include' }),
        fetch('/api/admissions/applications', { credentials: 'include' }),
      ]);
      const ja = await a.json();
      const jb = await b.json();
      if (a.ok) setPreRegs(ja.items ?? []);
      if (b.ok) setApps(jb.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const review = async (kind: 'prereg' | 'app', id: string, decision: 'validated' | 'rejected' | 'revision_required') => {
    const url = kind === 'prereg' ? `/api/admissions/preregistrations/${id}/review` : `/api/admissions/applications/${id}/review`;
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });

    if (!res.ok) {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Action refusee' : 'Action denied' });
      return;
    }

    toast({ title: language === 'fr' ? 'Decision enregistree' : 'Decision saved' });
    await load();
  };

  const renderTable = (rows: Row[], kind: 'prereg' | 'app') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidat</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Annee</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Soumis le</TableHead>
          <TableHead className="text-right">Decision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              {r.firstName} {r.lastName}
            </TableCell>
            <TableCell>{r.email}</TableCell>
            <TableCell>{r.academicYear}</TableCell>
            <TableCell>
              <Badge variant="outline">{statusLabel[r.status] ?? r.status}</Badge>
            </TableCell>
            <TableCell>{formatDateTimeIntl(r.submittedAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => void review(kind, r.id, 'validated')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Valider
                </Button>
                <Button size="sm" variant="outline" onClick={() => void review(kind, r.id, 'revision_required')}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Renvoyer
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void review(kind, r.id, 'rejected')}>
                  <XCircle className="mr-1 h-4 w-4" /> Rejeter
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration des admissions</h1>
        <p className="text-muted-foreground">UC 002-004 + UC 006-008 : affichage, validation, rejet et renvoi.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revue des dossiers</CardTitle>
          <CardDescription>Decidez du sort des preinscriptions et candidatures.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : (
            <Tabs defaultValue="prereg">
              <TabsList>
                <TabsTrigger value="prereg">Preinscriptions ({preRegs.length})</TabsTrigger>
                <TabsTrigger value="apps">Candidatures ({apps.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="prereg" className="mt-4">
                {renderTable(preRegs, 'prereg')}
              </TabsContent>
              <TabsContent value="apps" className="mt-4">
                {renderTable(apps, 'app')}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
