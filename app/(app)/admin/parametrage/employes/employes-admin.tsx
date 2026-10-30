'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, UserPlus } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type Row = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  service: string;
  statut: string;
  appRole: string | null;
  schedule: { startTime: string; endTime: string; workDays: unknown } | null;
};

const ISO_DAYS = [
  { v: 1, key: 'mon' },
  { v: 2, key: 'tue' },
  { v: 3, key: 'wed' },
  { v: 4, key: 'thu' },
  { v: 5, key: 'fri' },
  { v: 6, key: 'sat' },
  { v: 7, key: 'sun' },
] as const;

function parseWorkDays(w: unknown): number[] {
  if (!Array.isArray(w)) return [1, 2, 3, 4, 5];
  return (w as unknown[]).map(Number).filter((n) => n >= 1 && n <= 7);
}

export function EmployesAdmin() {
  const { t, language } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [matricule, setMatricule] = useState('');
  const [service, setService] = useState('');
  const [statut, setStatut] = useState<'actif' | 'inactif'>('actif');
  const [appRole, setAppRole] = useState<'employee' | 'hr_admin' | 'hr_auditor'>('employee');
  const [password, setPassword] = useState('');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('17:30');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.items)) setRows(json.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dayLabel = useCallback(
    (key: string) => {
      const map: Record<string, { fr: string; en: string }> = {
        mon: { fr: 'Lun', en: 'Mon' },
        tue: { fr: 'Mar', en: 'Tue' },
        wed: { fr: 'Mer', en: 'Wed' },
        thu: { fr: 'Jeu', en: 'Thu' },
        fri: { fr: 'Ven', en: 'Fri' },
        sat: { fr: 'Sam', en: 'Sat' },
        sun: { fr: 'Dim', en: 'Sun' },
      };
      return map[key]?.[language === 'en' ? 'en' : 'fr'] ?? key;
    },
    [language]
  );

  const openCreate = () => {
    setEditing(null);
    setNom('');
    setPrenom('');
    setEmail('');
    setMatricule('');
    setService('');
    setStatut('actif');
    setAppRole('employee');
    setPassword('');
    setStartTime('08:30');
    setEndTime('17:30');
    setWorkDays([1, 2, 3, 4, 5]);
    setDialogOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setNom(r.nom);
    setPrenom(r.prenom);
    setEmail(r.email);
    setMatricule(r.matricule);
    setService(r.service);
    setStatut(r.statut === 'inactif' ? 'inactif' : 'actif');
    setAppRole(
      r.appRole === 'hr_admin' ? 'hr_admin' : r.appRole === 'hr_auditor' ? 'hr_auditor' : 'employee'
    );
    setPassword('');
    const s = r.schedule;
    setStartTime(s?.startTime ?? '08:30');
    setEndTime(s?.endTime ?? '17:30');
    setWorkDays(parseWorkDays(s?.workDays));
    setDialogOpen(true);
  };

  const toggleDay = (v: number) => {
    setWorkDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const schedulePayload = useMemo(
    () => ({ startTime, endTime, workDays: workDays.length ? workDays : [1, 2, 3, 4, 5] }),
    [startTime, endTime, workDays]
  );

  const save = async () => {
    if (!nom.trim() || !prenom.trim() || !email.trim() || !matricule.trim() || !service.trim()) {
      toast({ variant: 'destructive', title: t('settings.validationRequired') });
      return;
    }
    if (!editing && password.length < 8) {
      toast({ variant: 'destructive', title: t('settings.passwordMin') });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: email.trim(),
          matricule: matricule.trim(),
          service: service.trim(),
          statut,
          appRole,
          schedule: schedulePayload,
        };
        if (password.trim().length >= 8) body.password = password.trim();
        const res = await fetch(`/api/admin/employees/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? 'ERR');
      } else {
        const res = await fetch('/api/admin/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.trim(),
            matricule: matricule.trim(),
            service: service.trim(),
            statut,
            appRole,
            password: password.trim(),
            schedule: schedulePayload,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? 'ERR');
      }
      toast({ title: t('common.save') });
      setDialogOpen(false);
      await load();
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

  const scheduleStr = (r: Row) => {
    if (!r.schedule) return '—';
    const wd = parseWorkDays(r.schedule.workDays).join(',');
    return `${r.schedule.startTime}–${r.schedule.endTime} (${wd})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('settings.employeesPageTitle')}</h1>
          <p className="text-muted-foreground">{t('settings.employeesPageSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" />
          {t('settings.addEmployee')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('adminEmployees.title')}</CardTitle>
          <CardDescription>{t('settings.employeesListHint')}</CardDescription>
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
                  <TableHead>{t('attendance.employee')}</TableHead>
                  <TableHead>{t('adminEmployees.matricule')}</TableHead>
                  <TableHead>{t('adminEmployees.service')}</TableHead>
                  <TableHead>{t('settings.scheduleCol')}</TableHead>
                  <TableHead>{t('adminEmployees.role')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">
                        {r.prenom} {r.nom}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.matricule}</TableCell>
                    <TableCell>{r.service}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{scheduleStr(r)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.appRole === 'hr_admin' ? 'default' : r.appRole === 'hr_auditor' ? 'outline' : 'secondary'
                        }
                      >
                        {r.appRole === 'hr_admin'
                          ? t('settings.appRoleHrAdmin')
                          : r.appRole === 'hr_auditor'
                            ? t('settings.appRoleHrAuditor')
                            : r.appRole === 'employee'
                              ? t('settings.appRoleEmployee')
                              : (r.appRole ?? '—')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.statut}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('settings.editEmployee') : t('settings.createEmployee')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('settings.fieldNom')}</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.fieldPrenom')}</Label>
                <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.fieldEmail')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.fieldMatricule')}</Label>
              <Input value={matricule} onChange={(e) => setMatricule(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.fieldService')}</Label>
              <Input value={service} onChange={(e) => setService(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Select value={statut} onValueChange={(v) => setStatut(v as 'actif' | 'inactif')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">actif</SelectItem>
                    <SelectItem value="inactif">inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('adminEmployees.role')}</Label>
                <Select
                  value={appRole}
                  onValueChange={(v) => setAppRole(v as 'employee' | 'hr_admin' | 'hr_auditor')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{t('settings.appRoleEmployee')}</SelectItem>
                    <SelectItem value="hr_admin">{t('settings.appRoleHrAdmin')}</SelectItem>
                    <SelectItem value="hr_auditor">{t('settings.appRoleHrAuditor')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{editing ? t('settings.fieldPasswordOptional') : t('settings.fieldPassword')}</Label>
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">{t('settings.planningSection')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('settings.fieldStart')}</Label>
                  <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="08:30" />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.fieldEnd')}</Label>
                  <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="17:30" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t('settings.workDaysHint')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ISO_DAYS.map(({ v, key }) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={workDays.includes(v) ? 'default' : 'outline'}
                    onClick={() => toggleDay(v)}
                  >
                    {dayLabel(key)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
