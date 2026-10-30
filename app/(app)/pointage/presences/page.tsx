'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileDown, Loader2 } from 'lucide-react';
import { useApp, usePermissions } from '@/lib/app-context';
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
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

type LocRef = { id: string; name: string } | null;

type ListItem = {
  id: string;
  employee: { nom: string; prenom: string; email: string; matricule: string; service: string };
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workedMinutes: number | null;
  checkInLocation: LocRef;
  checkOutLocation: LocRef;
};

export default function PresencesPage() {
  const { t, language } = useApp();
  const { canViewAttendanceDashboard, canExportAttendance } = usePermissions();
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [exportFrom, setExportFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [exportTo, setExportTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [scope, setScope] = useState<'self' | 'all'>(canViewAttendanceDashboard ? 'all' : 'self');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [items, setItems] = useState<ListItem[]>([]);

  const effectiveScope = useMemo(() => {
    if (!canViewAttendanceDashboard && scope === 'all') return 'self';
    return scope;
  }, [canViewAttendanceDashboard, scope]);

  useEffect(() => {
    if (canExportAttendance) {
      setExportFrom(date);
      setExportTo(date);
    }
  }, [date, canExportAttendance]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ date, scope: effectiveScope });
      const res = await fetch(`/api/attendance/list?${q}`, { credentials: 'include' });
      if (!res.ok) throw new Error('LOAD_FAILED');
      const json = (await res.json()) as { items: ListItem[] };
      setItems(json.items);
    } catch {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Chargement impossible.' : 'Could not load.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [date, effectiveScope, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = (s: string) => {
    if (s === 'present') return t('attendance.present');
    if (s === 'retard') return t('attendance.late');
    if (s === 'absent') return t('attendance.absent');
    return s;
  };

  const formatWorked = (m: number | null) => {
    if (m == null) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h${mm.toString().padStart(2, '0')}`;
  };

  const colCount = effectiveScope === 'all' ? 8 : 6;

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = `/api/attendance/export?from=${encodeURIComponent(exportFrom)}&to=${encodeURIComponent(exportTo)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: language === 'fr' ? 'Export impossible' : 'Export failed',
          description: String((err as { error?: string }).error ?? res.statusText),
          variant: 'destructive',
        });
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `presences_${exportFrom}_${exportTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({
        title: language === 'fr' ? 'Export prêt' : 'Export ready',
        description: language === 'fr' ? 'Le fichier a été téléchargé.' : 'File download started.',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('attendance.presencesTitle')}</h1>
        <p className="text-muted-foreground">{date}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>{t('nav.pointagePresences')}</CardTitle>
            <CardDescription>
              {canViewAttendanceDashboard
                ? language === 'fr'
                  ? 'Vue équipe ou personnelle.'
                  : 'Team or personal view.'
                : language === 'fr'
                  ? 'Vos pointages uniquement.'
                  : 'Your records only.'}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">{t('common.date')}</Label>
                <FrenchDateField id="date" value={date} onChange={setDate} className="w-[11rem]" />
              </div>
              {canViewAttendanceDashboard ? (
                <div className="flex gap-2">
                  <Button type="button" variant={effectiveScope === 'self' ? 'default' : 'outline'} onClick={() => setScope('self')}>
                    {t('attendance.scopeSelf')}
                  </Button>
                  <Button type="button" variant={effectiveScope === 'all' ? 'default' : 'outline'} onClick={() => setScope('all')}>
                    {t('attendance.scopeAll')}
                  </Button>
                </div>
              ) : null}
            </div>

            {canExportAttendance ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/25 bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
                <p className="w-full text-xs text-muted-foreground sm:order-first">{t('attendance.exportHelp')}</p>
                <div className="space-y-2">
                  <Label htmlFor="export-from">{t('attendance.exportFrom')}</Label>
                  <FrenchDateField id="export-from" value={exportFrom} onChange={setExportFrom} className="w-[11rem]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-to">{t('attendance.exportTo')}</Label>
                  <FrenchDateField id="export-to" value={exportTo} onChange={setExportTo} className="w-[11rem]" />
                </div>
                <Button type="button" variant="secondary" disabled={exporting} onClick={() => void handleExport()} className="sm:ml-auto">
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  {t('attendance.exportExcel')}
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {effectiveScope === 'all' ? (
                      <>
                        <TableHead>{t('attendance.employee')}</TableHead>
                        <TableHead>{t('attendance.service')}</TableHead>
                      </>
                    ) : null}
                    <TableHead>{t('attendance.status')}</TableHead>
                    <TableHead>{t('attendance.checkInCol')}</TableHead>
                    <TableHead>{t('attendance.locationIn')}</TableHead>
                    <TableHead>{t('attendance.checkOutCol')}</TableHead>
                    <TableHead>{t('attendance.locationOut')}</TableHead>
                    <TableHead>{t('attendance.worked')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                        {language === 'fr' ? 'Aucune donnée pour cette date.' : 'No data for this date.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row) => (
                      <TableRow key={row.id}>
                        {effectiveScope === 'all' ? (
                          <>
                            <TableCell className="font-medium">
                              {row.employee.prenom} {row.employee.nom}
                              <div className="text-xs text-muted-foreground">{row.employee.matricule}</div>
                            </TableCell>
                            <TableCell>{row.employee.service}</TableCell>
                          </>
                        ) : null}
                        <TableCell>
                          <Badge variant={row.status === 'retard' ? 'destructive' : 'secondary'}>{statusLabel(row.status)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.checkIn ? format(new Date(row.checkIn), 'HH:mm', { locale: fr }) : '—'}
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                          {row.checkInLocation?.name ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.checkOut ? format(new Date(row.checkOut), 'HH:mm', { locale: fr }) : '—'}
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                          {row.checkOutLocation?.name ?? '—'}
                        </TableCell>
                        <TableCell>{formatWorked(row.workedMinutes)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
