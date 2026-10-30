'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
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

type Row = { id: string; date: string; name: string };

export function HolidaysAdmin() {
  const { t, language } = useApp();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/public-holidays', { credentials: 'include' });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) setItems(j.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!date || !name.trim()) {
      toast({ variant: 'destructive', title: t('settings.validationRequired') });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/public-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, name: name.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'ERR');
      setDate('');
      setName('');
      await load();
      toast({ title: t('common.save') });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: e instanceof Error ? e.message : '—',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('settings.confirmDeleteHoliday'))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/public-holidays/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('ERR');
      await load();
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.holidaysPageTitle')}</h1>
        <p className="text-muted-foreground">{t('settings.holidaysPageSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.holidaysAddTitle')}</CardTitle>
          <CardDescription>{t('settings.holidaysAddDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label>{t('common.date')}</Label>
            <FrenchDateField value={date} onChange={setDate} className="w-[200px]" />
          </div>
          <div className="flex-1 space-y-2">
            <Label>{t('settings.holidayName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tabaski, Fête du travail…" />
          </div>
          <Button onClick={() => void add()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">{t('common.add')}</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.holidaysListTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.holidaysEmpty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('settings.holidayName')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.date}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
