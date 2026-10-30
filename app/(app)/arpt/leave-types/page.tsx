'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type LeaveType = {
  id: string;
  code: string;
  label: string;
  maxDaysPerYear: number;
  isActive: boolean;
};

export default function LeaveTypesPage() {
  const [items, setItems] = useState<LeaveType[]>([]);
  const [form, setForm] = useState({ code: '', label: '', maxDaysPerYear: 30 });

  const load = async () => {
    const res = await fetch('/api/arpt/leave-types');
    const json = await res.json().catch(() => ({ items: [] }));
    setItems(json.items ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    await fetch('/api/arpt/leave-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ code: '', label: '', maxDaysPerYear: 30 });
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Types de conges</h1>
      <Card>
        <CardHeader>
          <CardTitle>Creer un type</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={form.code} placeholder="Code" onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} />
          <Input value={form.label} placeholder="Libelle" onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} />
          <Input
            type="number"
            value={form.maxDaysPerYear}
            onChange={(e) => setForm((s) => ({ ...s, maxDaysPerYear: Number(e.target.value) }))}
          />
          <div className="md:col-span-3">
            <Button onClick={() => void submit()}>Ajouter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="font-medium">
                {item.label} ({item.code})
              </p>
              <p className="text-sm text-muted-foreground">
                Max/an: {item.maxDaysPerYear} - {item.isActive ? 'Actif' : 'Inactif'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
