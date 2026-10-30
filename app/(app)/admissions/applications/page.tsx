'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/lib/app-context';
import { toast } from '@/hooks/use-toast';

export default function ApplicationsPage() {
  const { language } = useApp();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: 'student',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    targetProgram: '',
    specialty: '',
    coverLetter: '',
    academicYear: '2026-2027',
  });

  const submit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.academicYear) {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Champs requis' : 'Required fields' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admissions/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'REQUEST_FAILED');

      toast({ title: language === 'fr' ? 'Candidature soumise' : 'Application submitted' });
      setForm({
        type: 'student',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        targetProgram: '',
        specialty: '',
        coverLetter: '',
        academicYear: '2026-2027',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Erreur de soumission' : 'Submission error',
        description: e instanceof Error ? e.message : '-',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Candidature ESMT</h1>
        <p className="text-muted-foreground">UC 005 - soumission de candidature etudiant/professeur.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulaire de candidature</CardTitle>
          <CardDescription>Completez le dossier avant soumission.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Type de candidature *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Etudiant</SelectItem>
                <SelectItem value="professor">Professeur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prenom *</Label>
              <Input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telephone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Programme cible</Label>
              <Input value={form.targetProgram} onChange={(e) => setForm((p) => ({ ...p, targetProgram: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Specialite</Label>
              <Input value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lettre de motivation</Label>
            <Textarea rows={6} value={form.coverLetter} onChange={(e) => setForm((p) => ({ ...p, coverLetter: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Annee academique *</Label>
            <Input value={form.academicYear} onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))} />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void submit()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Soumettre la candidature
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
