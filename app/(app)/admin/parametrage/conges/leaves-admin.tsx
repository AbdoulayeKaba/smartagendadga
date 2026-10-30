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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

type Emp = { id: string; nom: string; prenom: string; matricule: string };
type LeaveRow = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  note: string | null;
  employee: Emp;
};

const LEAVE_TYPES = ['conge_annuel', 'conge_maladie', 'sans_solde', 'autre'] as const;

export function LeavesAdmin() {
  const { t, language } = useApp();
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [items, setItems] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<(typeof LEAVE_TYPES)[number]>('conge_annuel');
  const [note, setNote] = useState('');

  const loadEmployees = useCallback(async () => {
    const res = await fetch('/api/employees', { credentials: 'include' });
    const j = await res.json();
    if (res.ok && Array.isArray(j.items)) {
      setEmployees(
        j.items.map((x: { id: string; nom: string; prenom: string; matricule: string }) => ({
          id: x.id,
          nom: x.nom,
          prenom: x.prenom,
          matricule: x.matricule,
        }))
      );
    }
  }, []);

  const loadLeaves = useCallback(async () => {
    const res = await fetch('/api/admin/leaves', { credentials: 'include' });
    const j = await res.json();
    if (res.ok && Array.isArray(j.items)) setItems(j.items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadEmployees(), loadLeaves()]);
    } finally {
      setLoading(false);
    }
  }, [loadEmployees, loadLeaves]);

  useEffect(() => {
    void load();
  }, [load]);

  const leaveTypeLabel = (k: string) => t(`settings.leaveType.${k}`);

  const add = async () => {
    if (!employeeId || !startDate || !endDate) {
      toast({ variant: 'destructive', title: t('settings.validationRequired') });
      return;
    }
    if (startDate > endDate) {
      toast({ variant: 'destructive', title: t('settings.invalidDateRange') });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          employeeId,
          startDate,
          endDate,
          type,
          note: note.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'ERR');
      setStartDate('');
      setEndDate('');
      setNote('');
      await loadLeaves();
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
    if (!window.confirm(t('settings.confirmDeleteLeave'))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leaves/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('ERR');
      await loadLeaves();
    } catch {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Erreur' : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.leavesPageTitle')}</h1>
        <p className="text-muted-foreground">{t('settings.leavesPageSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.leavesAddTitle')}</CardTitle>
          <CardDescription>{t('settings.leavesAddDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t('attendance.employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.prenom} {e.nom} ({e.matricule})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.leaveStart')}</Label>
            <FrenchDateField value={startDate} onChange={setStartDate} />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.leaveEnd')}</Label>
            <FrenchDateField value={endDate} onChange={setEndDate} />
          </div>
          <div className="space-y-2">
            <Label>{t('common.type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as (typeof LEAVE_TYPES)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    {leaveTypeLabel(lt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('settings.leaveNote')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void add()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">{t('common.add')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.leavesListTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.leavesEmpty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('attendance.employee')}</TableHead>
                  <TableHead>{t('settings.leaveStart')}</TableHead>
                  <TableHead>{t('settings.leaveEnd')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.employee.prenom} {r.employee.nom}
                      <div className="text-xs text-muted-foreground font-mono">{r.employee.matricule}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.startDate}</TableCell>
                    <TableCell className="font-mono text-sm">{r.endDate}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{leaveTypeLabel(r.type)}</Badge>
                    </TableCell>
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
