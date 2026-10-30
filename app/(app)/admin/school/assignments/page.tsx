'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Ref = { id: string; firstName?: string; lastName?: string; name?: string; label?: string; level?: string; section?: string | null; code?: string };

type Assignment = { id: string; teacher: Ref; subject: Ref; classroom: Ref; academicYear: Ref };

export default function AssignmentsAdminPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<Ref[]>([]);
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [classrooms, setClassrooms] = useState<Ref[]>([]);
  const [years, setYears] = useState<Ref[]>([]);
  const [form, setForm] = useState({ teacherId: '', subjectId: '', classroomId: '', academicYearId: '' });

  const load = async () => {
    const [a, t, s, c, y] = await Promise.all([
      fetch('/api/school/assignments', { credentials: 'include' }),
      fetch('/api/school/teachers', { credentials: 'include' }),
      fetch('/api/school/subjects', { credentials: 'include' }),
      fetch('/api/school/classrooms', { credentials: 'include' }),
      fetch('/api/school/academic-years', { credentials: 'include' }),
    ]);
    const ja = await a.json(); if (a.ok) setItems(ja.items ?? []);
    const jt = await t.json(); if (t.ok) setTeachers(jt.items ?? []);
    const js = await s.json(); if (s.ok) setSubjects(js.items ?? []);
    const jc = await c.json(); if (c.ok) setClassrooms(jc.items ?? []);
    const jy = await y.json(); if (y.ok) setYears(jy.items ?? []);
  };

  useEffect(() => { void load(); }, []);

  const add = async () => {
    const res = await fetch('/api/school/assignments', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setForm({ teacherId: '', subjectId: '', classroomId: '', academicYearId: '' }); await load(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Affectations pedagogiques</h1>
      <Card><CardHeader><CardTitle>Nouvelle affectation</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">
        <div><Label>Teacher ID</Label><Input value={form.teacherId} onChange={(e)=>setForm(p=>({...p,teacherId:e.target.value}))} placeholder={teachers[0]?.id ?? ''}/></div>
        <div><Label>Subject ID</Label><Input value={form.subjectId} onChange={(e)=>setForm(p=>({...p,subjectId:e.target.value}))} placeholder={subjects[0]?.id ?? ''}/></div>
        <div><Label>Classroom ID</Label><Input value={form.classroomId} onChange={(e)=>setForm(p=>({...p,classroomId:e.target.value}))} placeholder={classrooms[0]?.id ?? ''}/></div>
        <div><Label>Academic year ID</Label><Input value={form.academicYearId} onChange={(e)=>setForm(p=>({...p,academicYearId:e.target.value}))} placeholder={years[0]?.id ?? ''}/></div>
        <div className="flex items-end"><Button onClick={() => void add()}>Ajouter</Button></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Liste des affectations</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Professeur</TableHead><TableHead>Matiere</TableHead><TableHead>Classe</TableHead><TableHead>Annee</TableHead></TableRow></TableHeader><TableBody>{items.map((i)=><TableRow key={i.id}><TableCell>{i.teacher.firstName} {i.teacher.lastName}</TableCell><TableCell>{i.subject.code} - {i.subject.name}</TableCell><TableCell>{i.classroom.level} {i.classroom.name}{i.classroom.section ? ` (${i.classroom.section})` : ''}</TableCell><TableCell>{i.academicYear.label}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
