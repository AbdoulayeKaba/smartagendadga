'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/lib/app-context';
import { toast } from '@/hooks/use-toast';

type Row = { id: string; matricule: string; firstName: string; lastName: string; email: string | null; status: string; classroom?: { name: string; level: string; section: string | null } | null };

export default function StudentsAdminPage() {
  const { language } = useApp();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ matricule: '', firstName: '', lastName: '', email: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/students', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.matricule || !form.firstName || !form.lastName) {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Champs requis' : 'Required fields' });
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/school/students/${editingId}` : '/api/school/students';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('SAVE_FAILED');
      setForm({ matricule: '', firstName: '', lastName: '', email: '' });
      setEditingId(null);
      await load();
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setForm({ matricule: r.matricule, firstName: r.firstName, lastName: r.lastName, email: r.email ?? '' });
  };

  const remove = async (id: string) => {
    if (!window.confirm(language === 'fr' ? 'Supprimer cet eleve ?' : 'Delete this student?')) return;
    const res = await fetch(`/api/school/students/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Gestion des eleves</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1"><Label>Matricule</Label><Input value={form.matricule} onChange={(e)=>setForm(p=>({...p,matricule:e.target.value}))}/></div>
            <div className="space-y-1"><Label>Prenom</Label><Input value={form.firstName} onChange={(e)=>setForm(p=>({...p,firstName:e.target.value}))}/></div>
            <div className="space-y-1"><Label>Nom</Label><Input value={form.lastName} onChange={(e)=>setForm(p=>({...p,lastName:e.target.value}))}/></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e)=>setForm(p=>({...p,email:e.target.value}))}/></div>
          </div>
          <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}<span className="ml-2">{editingId ? 'Mettre a jour' : 'Ajouter'}</span></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Liste des eleves</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Chargement...</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Matricule</TableHead><TableHead>Eleve</TableHead><TableHead>Email</TableHead><TableHead>Classe</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.matricule}</TableCell>
                    <TableCell>{r.firstName} {r.lastName}</TableCell>
                    <TableCell>{r.email ?? '-'}</TableCell>
                    <TableCell>{r.classroom ? `${r.classroom.level} ${r.classroom.name}${r.classroom.section ? ` (${r.classroom.section})` : ''}` : '-'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}><Pencil className="h-4 w-4"/></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(r.id)}><Trash2 className="h-4 w-4"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
