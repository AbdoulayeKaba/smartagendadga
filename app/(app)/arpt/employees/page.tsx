'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type EmployeeItem = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  service: string;
  role: string;
};

export default function ArptEmployeesPage() {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    matricule: '',
    service: '',
    role: 'employe',
    password: '',
  });

  const load = async () => {
    const res = await fetch('/api/arpt/employees');
    const json = await res.json().catch(() => ({ items: [] }));
    setItems(json.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    await fetch('/api/arpt/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ nom: '', prenom: '', email: '', matricule: '', service: '', role: 'employe', password: '' });
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestion des employes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau collaborateur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Nom" value={form.nom} onChange={(e) => setForm((s) => ({ ...s, nom: e.target.value }))} />
          <Input placeholder="Prenom" value={form.prenom} onChange={(e) => setForm((s) => ({ ...s, prenom: e.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          <Input placeholder="Matricule" value={form.matricule} onChange={(e) => setForm((s) => ({ ...s, matricule: e.target.value }))} />
          <Input placeholder="Service" value={form.service} onChange={(e) => setForm((s) => ({ ...s, service: e.target.value }))} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
          >
            <option value="admin">Admin</option>
            <option value="rh">RH</option>
            <option value="chef">Chef</option>
            <option value="employe">Employe</option>
          </select>
          <Input
            placeholder="Mot de passe initial"
            type="password"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          />
          <div className="md:col-span-2">
            <Button onClick={() => void submit()}>Creer</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annuaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((e) => (
            <div key={e.id} className="rounded-lg border p-3">
              <p className="font-medium">
                {e.prenom} {e.nom} - {e.role}
              </p>
              <p className="text-sm text-muted-foreground">
                {e.email} / {e.matricule} / {e.service}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
