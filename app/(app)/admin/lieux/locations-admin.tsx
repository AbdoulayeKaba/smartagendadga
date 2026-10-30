'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

type Loc = { id: string; name: string; latitude: number; longitude: number };

export function LocationsAdmin() {
  const { t, language } = useApp();
  const [items, setItems] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/locations', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.items)) setItems(json.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addLocation = async () => {
    const latitude = Number(lat.replace(',', '.'));
    const longitude = Number(lng.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Vérifiez les champs.' : 'Check the fields.',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), latitude, longitude }),
      });
      if (!res.ok) throw new Error('FAIL');
      setName('');
      setLat('');
      setLng('');
      await load();
      toast({ title: t('common.save') });
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (l: Loc) => {
    setEditingId(l.id);
    setEditName(l.name);
    setEditLat(String(l.latitude));
    setEditLng(String(l.longitude));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const latitude = Number(editLat.replace(',', '.'));
    const longitude = Number(editLng.replace(',', '.'));
    if (!editName.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), latitude, longitude }),
      });
      if (!res.ok) throw new Error('FAIL');
      setEditingId(null);
      await load();
      toast({ title: t('common.save') });
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(language === 'fr' ? 'Supprimer ce lieu ?' : 'Delete this site?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('FAIL');
      if (editingId === id) setEditingId(null);
      await load();
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('adminLocations.title')}</CardTitle>
          <CardDescription>{t('adminLocations.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 border-b pb-6 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>{t('adminLocations.name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site principal" />
            </div>
            <div className="space-y-2">
              <Label>{t('adminLocations.lat')}</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="9.5092" />
            </div>
            <div className="space-y-2">
              <Label>{t('adminLocations.lng')}</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-13.7122" />
            </div>
            <div className="md:col-span-4">
              <Button onClick={() => void addLocation()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-2">{t('adminLocations.add')}</span>
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('adminLocations.none')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminLocations.name')}</TableHead>
                  <TableHead>{t('adminLocations.lat')}</TableHead>
                  <TableHead>{t('adminLocations.lng')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id}>
                    {editingId === l.id ? (
                      <>
                        <TableCell>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={editLat} onChange={(e) => setEditLat(e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={editLng} onChange={(e) => setEditLng(e.target.value)} />
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="default" disabled={saving} onClick={() => void saveEdit()}>
                            {t('adminLocations.save')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            {t('common.cancel')}
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="font-mono text-sm">{l.latitude}</TableCell>
                        <TableCell className="font-mono text-sm">{l.longitude}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(l.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
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
