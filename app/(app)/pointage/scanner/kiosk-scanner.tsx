'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

type Action = 'check_in' | 'check_out';

export function KioskScanner() {
  const { t, language } = useApp();
  const [action, setAction] = useState<Action>('check_in');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string>('_none');
  const [manualToken, setManualToken] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null);
  const punchLock = useRef(false);
  const lastPunchKey = useRef<{ key: string; at: number } | null>(null);
  const punchRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const readerId = 'kiosk-qr-reader';

  useEffect(() => {
    void fetch('/api/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { items?: { id: string; name: string }[] }) => setLocations(j.items ?? []))
      .catch(() => setLocations([]));
  }, []);

  const punch = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token || punchLock.current) return;
      const now = Date.now();
      const dedupeKey = `${action}:${token.slice(0, 40)}`;
      const prev = lastPunchKey.current;
      if (prev && prev.key === dedupeKey && now - prev.at < 4500) return;

      punchLock.current = true;
      setSubmitting(true);
      try {
        const loc =
          locationId && locationId !== '_none' ? locationId : undefined;
        const res = await fetch('/api/attendance/kiosk-punch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, action, locationId: loc }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof json.message === 'string' ? json.message : 'ERR');
        }
        lastPunchKey.current = { key: dedupeKey, at: Date.now() };
        toast({
          title: t('scanner.success'),
          description:
            json.employee != null
              ? `${json.employee.prenom} ${json.employee.nom} — ${json.message ?? ''}`
              : (json.message as string) ?? '',
        });
        setLastScan('');
        setManualToken('');
      } catch (e) {
        toast({
          title: language === 'fr' ? 'Erreur' : 'Error',
          description: e instanceof Error ? e.message : '—',
          variant: 'destructive',
        });
      } finally {
        punchLock.current = false;
        setSubmitting(false);
      }
    },
    [action, language, locationId, t]
  );

  useEffect(() => {
    punchRef.current = punch;
  }, [punch]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    await stopCamera();
    const mod = await import('html5-qrcode');
    const Html5QrcodeScanner = mod.Html5QrcodeScanner;
    const scanner = new Html5QrcodeScanner(
      readerId,
      { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
      false
    );
    scannerRef.current = scanner;
    setCameraOn(true);
    scanner.render(
      (decodedText) => {
        setLastScan(decodedText);
        void punchRef.current(decodedText);
      },
      () => {}
    );
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('scanner.title')}</h1>
        <p className="text-muted-foreground">{t('scanner.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4" />
            {t('scanner.title')}
          </CardTitle>
          <CardDescription>{t('attendance.locationOptional')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('scanner.actionIn')} / {t('scanner.actionOut')}</Label>
            <RadioGroup
              value={action}
              onValueChange={(v) => setAction(v as Action)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="check_in" id="in" />
                <Label htmlFor="in">{t('scanner.actionIn')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="check_out" id="out" />
                <Label htmlFor="out">{t('scanner.actionOut')}</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>{t('attendance.locationOptional')}</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder={t('attendance.locationNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('attendance.locationNone')}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {!cameraOn ? (
                <Button type="button" onClick={() => void startCamera()} disabled={submitting}>
                  {t('scanner.startCamera')}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => void stopCamera()}>
                  {t('scanner.stopCamera')}
                </Button>
              )}
            </div>
            <div id={readerId} className="min-h-[280px] w-full max-w-md rounded-lg border bg-muted/20" />
            {lastScan ? (
              <p className="text-xs text-muted-foreground break-all">
                Scan: {lastScan.slice(0, 80)}
                {lastScan.length > 80 ? '…' : ''}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="manual">{t('scanner.manualToken')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="manual"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="JWT ou URL ?t=…"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                disabled={submitting || !manualToken.trim()}
                onClick={() => void punch(manualToken)}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('scanner.submit')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
