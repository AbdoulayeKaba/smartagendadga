'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Year = { id: string; label: string; startDate: string; endDate: string; isCurrent: boolean };
type Subject = { id: string; code: string; name: string; coefficient: number };

export default function AcademicsAdminPage() {
  const [years, setYears] = useState<Year[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [yearForm, setYearForm] = useState({ label: '', startDate: '', endDate: '', isCurrent: true });
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', coefficient: '1' });

  const load = async () => {
    const [a, b] = await Promise.all([
      fetch('/api/school/academic-years', { credentials: 'include' }),
      fetch('/api/school/subjects', { credentials: 'include' }),
    ]);
    const ja = await a.json();
    const jb = await b.json();
    if (a.ok) setYears(ja.items ?? []);
    if (b.ok) setSubjects(jb.items ?? []);
  };

  useEffect(() => { void load(); }, []);

  const addYear = async () => {
    const res = await fetch('/api/school/academic-years', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...yearForm }),
    });
    if (res.ok) { setYearForm({ label: '', startDate: '', endDate: '', isCurrent: true }); await load(); }
  };

  const addSubject = async () => {
    const res = await fetch('/api/school/subjects', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...subjectForm, coefficient: Number(subjectForm.coefficient) || 1 }),
    });
    if (res.ok) { setSubjectForm({ code: '', name: '', coefficient: '1' }); await load(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Structure academique</h1>
      <Tabs defaultValue="years">
        <TabsList>
          <TabsTrigger value="years">Annees academiques</TabsTrigger>
          <TabsTrigger value="subjects">Matieres</TabsTrigger>
        </TabsList>

        <TabsContent value="years" className="space-y-4">
          <Card><CardHeader><CardTitle>Nouvelle annee</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <div><Label>Libelle</Label><Input value={yearForm.label} onChange={(e)=>setYearForm(p=>({...p,label:e.target.value}))}/></div>
            <div><Label>Debut</Label><Input value={yearForm.startDate} onChange={(e)=>setYearForm(p=>({...p,startDate:e.target.value}))} placeholder="2026-09-01"/></div>
            <div><Label>Fin</Label><Input value={yearForm.endDate} onChange={(e)=>setYearForm(p=>({...p,endDate:e.target.value}))} placeholder="2027-07-31"/></div>
            <div className="flex items-end"><Button onClick={() => void addYear()}>Ajouter</Button></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Liste</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Libelle</TableHead><TableHead>Debut</TableHead><TableHead>Fin</TableHead><TableHead>Courante</TableHead></TableRow></TableHeader><TableBody>{years.map((y)=><TableRow key={y.id}><TableCell>{y.label}</TableCell><TableCell>{y.startDate}</TableCell><TableCell>{y.endDate}</TableCell><TableCell>{y.isCurrent ? 'Oui' : 'Non'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card><CardHeader><CardTitle>Nouvelle matiere</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <div><Label>Code</Label><Input value={subjectForm.code} onChange={(e)=>setSubjectForm(p=>({...p,code:e.target.value}))}/></div>
            <div><Label>Nom</Label><Input value={subjectForm.name} onChange={(e)=>setSubjectForm(p=>({...p,name:e.target.value}))}/></div>
            <div><Label>Coefficient</Label><Input value={subjectForm.coefficient} onChange={(e)=>setSubjectForm(p=>({...p,coefficient:e.target.value}))}/></div>
            <div className="flex items-end"><Button onClick={() => void addSubject()}>Ajouter</Button></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Liste</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Matiere</TableHead><TableHead>Coef</TableHead></TableRow></TableHeader><TableBody>{subjects.map((s)=><TableRow key={s.id}><TableCell>{s.code}</TableCell><TableCell>{s.name}</TableCell><TableCell>{s.coefficient}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
