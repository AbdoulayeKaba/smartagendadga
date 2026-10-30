'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/lib/app-context';

type Row = { id: string; name: string; level: string; section: string | null; capacity: number; building: string | null };

export default function ClassroomsAdminPage() {
  const { language } = useApp();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', level: '', section: '', capacity: '30', building: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/classrooms', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const payload = { ...form, capacity: Number(form.capacity) || 30 };
    const url = editingId ? `/api/school/classrooms/${editingId}` : '/api/school/classrooms';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      setEditingId(null);
      setForm({ name: '', level: '', section: '', capacity: '30', building: '' });
      await load();
    }
  };

  const edit = (r: Row) => { setEditingId(r.id); setForm({ name: r.name, level: r.level, section: r.section ?? '', capacity: String(r.capacity), building: r.building ?? '' }); };
  const remove = async (id: string) => { if (!window.confirm(language === 'fr' ? 'Supprimer cette salle ?' : 'Delete this classroom?')) return; const res = await fetch(`/api/school/classrooms/${id}`, { method: 'DELETE', credentials: 'include' }); if (res.ok) await load(); };

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Gestion des salles et classes</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>Nom</Label><Input value={form.name} onChange={(e)=>setForm(p=>({...p,name:e.target.value}))}/></div>
          <div><Label>Niveau</Label><Input value={form.level} onChange={(e)=>setForm(p=>({...p,level:e.target.value}))}/></div>
          <div><Label>Section</Label><Input value={form.section} onChange={(e)=>setForm(p=>({...p,section:e.target.value}))}/></div>
          <div><Label>Capacite</Label><Input value={form.capacity} onChange={(e)=>setForm(p=>({...p,capacity:e.target.value}))}/></div>
          <div><Label>Batiment</Label><Input value={form.building} onChange={(e)=>setForm(p=>({...p,building:e.target.value}))}/></div>
        </div>
        <Button onClick={() => void save()}><Plus className="h-4 w-4"/><span className="ml-2">{editingId ? 'Mettre a jour' : 'Ajouter'}</span></Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Liste des classes</CardTitle></CardHeader><CardContent>
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Chargement...</div> : (
          <Table><TableHeader><TableRow><TableHead>Classe</TableHead><TableHead>Niveau</TableHead><TableHead>Section</TableHead><TableHead>Capacite</TableHead><TableHead>Batiment</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((r)=><TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell>{r.level}</TableCell><TableCell>{r.section ?? '-'}</TableCell><TableCell>{r.capacity}</TableCell><TableCell>{r.building ?? '-'}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={()=>edit(r)}><Pencil className="h-4 w-4"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={()=>void remove(r.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
