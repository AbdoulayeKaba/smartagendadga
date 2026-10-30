'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/lib/datetime';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { useApp, usePermissions } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  actorId: string;
  actorEmail: string;
  actorName: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

function MetaCell({ value }: { value: unknown }) {
  if (value == null || (typeof value === 'object' && value !== null && Object.keys(value as object).length === 0)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  const short = str.length > 120 ? `${str.slice(0, 117)}…` : str;
  return (
    <code className="block max-w-[220px] truncate rounded bg-muted/80 px-2 py-1 text-[11px] leading-snug" title={str}>
      {short}
    </code>
  );
}

export default function AuditLogPage() {
  const { t } = useApp();
  const { canViewAuditLog, canManageAttendanceAdmin } = usePermissions();
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!canViewAuditLog) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs?limit=100', { credentials: 'include' });
      const json = (await res.json()) as { items?: AuditRow[] };
      if (res.ok && Array.isArray(json.items)) setItems(json.items);
      else setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canViewAuditLog]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.06] p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('auditLogPage.title')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('auditLogPage.subtitle')}</p>
              {!canManageAttendanceAdmin ? (
                <Badge variant="secondary" className="mt-3 font-normal">
                  {t('auditLogPage.readOnlyBadge')}
                </Badge>
              ) : null}
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 bg-background/80 backdrop-blur" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">{t('auditLogPage.refresh')}</span>
          </Button>
        </div>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
          <CardTitle className="text-base font-semibold">{t('admin.auditLog')}</CardTitle>
          <CardDescription>{t('auditLogPage.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('auditLogPage.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">{t('auditLogPage.colWhen')}</TableHead>
                    <TableHead>{t('auditLogPage.colAction')}</TableHead>
                    <TableHead>{t('auditLogPage.colEntity')}</TableHead>
                    <TableHead>{t('auditLogPage.colActor')}</TableHead>
                    <TableHead className="whitespace-nowrap">{t('auditLogPage.colIp')}</TableHead>
                    <TableHead>{t('auditLogPage.colMeta')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {format(new Date(row.createdAt), 'PPp', { locale: DATE_FNS_LOCALE })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-normal">
                          {row.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{row.entity}</span>
                        {row.entityId ? (
                          <div className="mt-0.5 max-w-[140px] truncate font-mono text-xs text-muted-foreground" title={row.entityId}>
                            {row.entityId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{row.actorName}</div>
                        <div className="text-xs text-muted-foreground">{row.actorEmail}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.ip ?? '—'}</TableCell>
                      <TableCell>
                        <MetaCell value={row.meta} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
