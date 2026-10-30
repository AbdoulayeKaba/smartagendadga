'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useApp } from '@/lib/app-context';

type Row = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; profession: string | null };

export default function ParentsAdminPage() {
  const { language } = useApp();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', profession: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/school/parents', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const url = editingId ? `/api/school/parents/${editingId}` : '/api/school/parents';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      setEditingId(null);
      setForm({ firstName: '', lastName: '', email: '', phone: '', profession: '' });
      await load();
    }
  };

  const edit = (r: Row) => { setEditingId(r.id); setForm({ firstName: r.firstName, lastName: r.lastName, email: r.email ?? '', phone: r.phone ?? '', profession: r.profession ?? '' }); };
  const remove = async (id: string) => { if (!window.confirm(language === 'fr' ? 'Supprimer ce parent ?' : 'Delete this parent?')) return; const res = await fetch(`/api/school/parents/${id}`, { method: 'DELETE', credentials: 'include' }); if (res.ok) await load(); };

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Gestion des parents</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label>Prenom</Label><Input value={form.firstName} onChange={(e)=>setForm(p=>({...p,firstName:e.target.value}))}/></div>
          <div><Label>Nom</Label><Input value={form.lastName} onChange={(e)=>setForm(p=>({...p,lastName:e.target.value}))}/></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e)=>setForm(p=>({...p,email:e.target.value}))}/></div>
          <div><Label>Telephone</Label><Input value={form.phone} onChange={(e)=>setForm(p=>({...p,phone:e.target.value}))}/></div>
          <div><Label>Profession</Label><Input value={form.profession} onChange={(e)=>setForm(p=>({...p,profession:e.target.value}))}/></div>
        </div>
        <Button onClick={() => void save()}><Plus className="h-4 w-4"/><span className="ml-2">{editingId ? 'Mettre a jour' : 'Ajouter'}</span></Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Liste des parents</CardTitle></CardHeader><CardContent>
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Chargement...</div> : (
          <Table><TableHeader><TableRow><TableHead>Nom complet</TableHead><TableHead>Email</TableHead><TableHead>Telephone</TableHead><TableHead>Profession</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((r)=><TableRow key={r.id}><TableCell>{r.firstName} {r.lastName}</TableCell><TableCell>{r.email ?? '-'}</TableCell><TableCell>{r.phone ?? '-'}</TableCell><TableCell>{r.profession ?? '-'}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={()=>edit(r)}><Pencil className="h-4 w-4"/></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={()=>void remove(r.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
