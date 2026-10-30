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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  rejectionReason: string | null;
};

const LEAVE_TYPES = ['conge_annuel', 'conge_maladie', 'sans_solde', 'autre'] as const;

export default function PointageCongesPage() {
  const { t, language } = useApp();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<(typeof LEAVE_TYPES)[number]>('conge_annuel');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaves/my', { credentials: 'include' });
      const j = await res.json();
      if (res.ok && Array.isArray(j.items)) setRows(j.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: t('settings.validationRequired') });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/leaves/my', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startDate, endDate, type, note: note.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'ERR');
      setStartDate('');
      setEndDate('');
      setNote('');
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

  const cancel = async (id: string) => {
    if (!window.confirm(t('settings.confirmCancelLeave'))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leaves/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) throw new Error('ERR');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: LeaveRow['status']) => t(`settings.leaveStatus.${s}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.myLeavesTitle')}</h1>
        <p className="text-muted-foreground">{t('settings.myLeavesSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.newLeaveRequest')}</CardTitle>
          <CardDescription>{t('settings.leavesAddDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
                    {t(`settings.leaveType.${lt}`)}
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
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">{t('settings.submitLeave')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.myLeaveHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.leaveStart')}</TableHead>
                  <TableHead>{t('settings.leaveEnd')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.startDate}</TableCell>
                    <TableCell className="font-mono text-sm">{r.endDate}</TableCell>
                    <TableCell>{t(`settings.leaveType.${r.type}`)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {['draft', 'submitted'].includes(r.status) ? (
                        <Button size="icon" variant="ghost" className="text-warning" onClick={() => void cancel(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
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
