'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SchoolAdvancedOpsPage() {
  const [timetable, setTimetable] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);

  const [sessionForm, setSessionForm] = useState({ assignmentId: '', teacherId: '', classroomId: '', subjectId: '', academicYearId: '', weekday: 'monday', startTime: '08:00', endTime: '10:00', roomLabel: '' });
  const [gradeForm, setGradeForm] = useState({ studentId: '', assignmentId: '', subjectId: '', teacherId: '', academicYearId: '', assessmentType: 'exam', score: '0', maxScore: '20', assessmentDate: '2026-10-10', comment: '' });
  const [absenceForm, setAbsenceForm] = useState({ studentId: '', assignmentId: '', academicYearId: '', date: '2026-10-10', startTime: '08:00', endTime: '10:00', status: 'pending', reason: '' });

  const load = async () => {
    const [a, b, c] = await Promise.all([
      fetch('/api/school/timetable', { credentials: 'include' }),
      fetch('/api/school/grades', { credentials: 'include' }),
      fetch('/api/school/absences', { credentials: 'include' }),
    ]);
    const ja = await a.json(); if (a.ok) setTimetable(ja.items ?? []);
    const jb = await b.json(); if (b.ok) setGrades(jb.items ?? []);
    const jc = await c.json(); if (c.ok) setAbsences(jc.items ?? []);
  };

  useEffect(() => { void load(); }, []);

  const createSession = async () => { const res = await fetch('/api/school/timetable', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sessionForm) }); if (res.ok) await load(); };
  const createGrade = async () => { const res = await fetch('/api/school/grades', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...gradeForm, score: Number(gradeForm.score), maxScore: Number(gradeForm.maxScore) }) }); if (res.ok) await load(); };
  const createAbsence = async () => { const res = await fetch('/api/school/absences', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(absenceForm) }); if (res.ok) await load(); };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Operations academiques</h1>
      <Tabs defaultValue="timetable">
        <TabsList>
          <TabsTrigger value="timetable">Emploi du temps</TabsTrigger>
          <TabsTrigger value="grades">Notes</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
        </TabsList>

        <TabsContent value="timetable" className="space-y-4">
          <Card><CardHeader><CardTitle>Ajouter un cours</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <div><Label>Assignment ID</Label><Input value={sessionForm.assignmentId} onChange={(e)=>setSessionForm(p=>({...p,assignmentId:e.target.value}))}/></div>
            <div><Label>Teacher ID</Label><Input value={sessionForm.teacherId} onChange={(e)=>setSessionForm(p=>({...p,teacherId:e.target.value}))}/></div>
            <div><Label>Classroom ID</Label><Input value={sessionForm.classroomId} onChange={(e)=>setSessionForm(p=>({...p,classroomId:e.target.value}))}/></div>
            <div><Label>Subject ID</Label><Input value={sessionForm.subjectId} onChange={(e)=>setSessionForm(p=>({...p,subjectId:e.target.value}))}/></div>
            <div><Label>Academic year ID</Label><Input value={sessionForm.academicYearId} onChange={(e)=>setSessionForm(p=>({...p,academicYearId:e.target.value}))}/></div>
            <div><Label>Weekday</Label><Input value={sessionForm.weekday} onChange={(e)=>setSessionForm(p=>({...p,weekday:e.target.value}))}/></div>
            <div><Label>Start</Label><Input value={sessionForm.startTime} onChange={(e)=>setSessionForm(p=>({...p,startTime:e.target.value}))}/></div>
            <div><Label>End</Label><Input value={sessionForm.endTime} onChange={(e)=>setSessionForm(p=>({...p,endTime:e.target.value}))}/></div>
            <div><Label>Salle</Label><Input value={sessionForm.roomLabel} onChange={(e)=>setSessionForm(p=>({...p,roomLabel:e.target.value}))}/></div>
            <div className="md:col-span-4"><Button onClick={() => void createSession()}>Enregistrer</Button></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Planning</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Jour</TableHead><TableHead>Horaire</TableHead><TableHead>Matiere</TableHead><TableHead>Classe</TableHead><TableHead>Prof</TableHead></TableRow></TableHeader><TableBody>{timetable.map((s)=><TableRow key={s.id}><TableCell>{s.weekday}</TableCell><TableCell>{s.startTime} - {s.endTime}</TableCell><TableCell>{s.subject?.name}</TableCell><TableCell>{s.classroom?.level} {s.classroom?.name}</TableCell><TableCell>{s.teacher?.firstName} {s.teacher?.lastName}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card><CardHeader><CardTitle>Saisir une note</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Student ID" value={gradeForm.studentId} onChange={(e)=>setGradeForm(p=>({...p,studentId:e.target.value}))}/>
            <Input placeholder="Assignment ID" value={gradeForm.assignmentId} onChange={(e)=>setGradeForm(p=>({...p,assignmentId:e.target.value}))}/>
            <Input placeholder="Subject ID" value={gradeForm.subjectId} onChange={(e)=>setGradeForm(p=>({...p,subjectId:e.target.value}))}/>
            <Input placeholder="Teacher ID" value={gradeForm.teacherId} onChange={(e)=>setGradeForm(p=>({...p,teacherId:e.target.value}))}/>
            <Input placeholder="Academic year ID" value={gradeForm.academicYearId} onChange={(e)=>setGradeForm(p=>({...p,academicYearId:e.target.value}))}/>
            <Input placeholder="Type" value={gradeForm.assessmentType} onChange={(e)=>setGradeForm(p=>({...p,assessmentType:e.target.value}))}/>
            <Input placeholder="Score" value={gradeForm.score} onChange={(e)=>setGradeForm(p=>({...p,score:e.target.value}))}/>
            <Input placeholder="Max" value={gradeForm.maxScore} onChange={(e)=>setGradeForm(p=>({...p,maxScore:e.target.value}))}/>
            <Input placeholder="Date" value={gradeForm.assessmentDate} onChange={(e)=>setGradeForm(p=>({...p,assessmentDate:e.target.value}))}/>
            <Input placeholder="Comment" value={gradeForm.comment} onChange={(e)=>setGradeForm(p=>({...p,comment:e.target.value}))}/>
            <div className="md:col-span-4"><Button onClick={() => void createGrade()}>Enregistrer note</Button></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Historique des notes</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Eleve</TableHead><TableHead>Matiere</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{grades.map((g)=><TableRow key={g.id}><TableCell>{g.student?.firstName} {g.student?.lastName}</TableCell><TableCell>{g.subject?.name}</TableCell><TableCell>{g.assessmentType}</TableCell><TableCell>{g.score}/{g.maxScore}</TableCell><TableCell>{g.assessmentDate}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="absences" className="space-y-4">
          <Card><CardHeader><CardTitle>Declarer une absence</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Student ID" value={absenceForm.studentId} onChange={(e)=>setAbsenceForm(p=>({...p,studentId:e.target.value}))}/>
            <Input placeholder="Assignment ID" value={absenceForm.assignmentId} onChange={(e)=>setAbsenceForm(p=>({...p,assignmentId:e.target.value}))}/>
            <Input placeholder="Academic year ID" value={absenceForm.academicYearId} onChange={(e)=>setAbsenceForm(p=>({...p,academicYearId:e.target.value}))}/>
            <Input placeholder="Date" value={absenceForm.date} onChange={(e)=>setAbsenceForm(p=>({...p,date:e.target.value}))}/>
            <Input placeholder="Start" value={absenceForm.startTime} onChange={(e)=>setAbsenceForm(p=>({...p,startTime:e.target.value}))}/>
            <Input placeholder="End" value={absenceForm.endTime} onChange={(e)=>setAbsenceForm(p=>({...p,endTime:e.target.value}))}/>
            <Input placeholder="Status" value={absenceForm.status} onChange={(e)=>setAbsenceForm(p=>({...p,status:e.target.value}))}/>
            <Input placeholder="Reason" value={absenceForm.reason} onChange={(e)=>setAbsenceForm(p=>({...p,reason:e.target.value}))}/>
            <div className="md:col-span-4"><Button onClick={() => void createAbsence()}>Enregistrer absence</Button></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Suivi absences</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Eleve</TableHead><TableHead>Date</TableHead><TableHead>Plage</TableHead><TableHead>Statut</TableHead><TableHead>Motif</TableHead></TableRow></TableHeader><TableBody>{absences.map((a)=><TableRow key={a.id}><TableCell>{a.student?.firstName} {a.student?.lastName}</TableCell><TableCell>{a.date}</TableCell><TableCell>{a.startTime ?? '-'} - {a.endTime ?? '-'}</TableCell><TableCell>{a.status}</TableCell><TableCell>{a.reason ?? '-'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
