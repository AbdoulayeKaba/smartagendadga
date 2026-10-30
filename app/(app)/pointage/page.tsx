'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, LogIn, LogOut, Clock3, Fingerprint, ShieldCheck } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

type LocRef = { id: string; name: string } | null;
type BiometricStatus = {
  enrolled: boolean;
  credentialCount: number;
};

type TodayResponse = {
  date: string;
  timezone: string;
  schedule: {
    startTime: string;
    endTime: string;
    workDay: boolean;
    dayContext: 'workday' | 'weekend' | 'public_holiday' | 'on_leave';
    publicHolidayName: string | null;
    leaveType: string | null;
  };
  attendance: {
    id: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    workedMinutes: number | null;
    checkInLocation: LocRef;
    checkOutLocation: LocRef;
  } | null;
};

function formatWorked(m: number | null | undefined): string {
  if (m == null) return '—';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${mm.toString().padStart(2, '0')}`;
}

export default function PointagePage() {
  const { t, language } = useApp();
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [data, setData] = useState<TodayResponse | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [punchLocationId, setPunchLocationId] = useState<string>('_none');
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>({ enrolled: false, credentialCount: 0 });
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, locRes] = await Promise.all([
        fetch('/api/attendance/today', { credentials: 'include' }),
        fetch('/api/locations', { credentials: 'include' }),
      ]);
      if (!todayRes.ok) throw new Error('LOAD_FAILED');
      const json = (await todayRes.json()) as TodayResponse;
      setData(json);
      if (locRes.ok) {
        const locJson = (await locRes.json()) as { items: { id: string; name: string }[] };
        setLocations(locJson.items ?? []);
      }
      const bioRes = await fetch('/api/auth/webauthn/status', { credentials: 'include' });
      if (bioRes.ok) {
        setBiometricStatus((await bioRes.json()) as BiometricStatus);
      }
    } catch {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible de charger le pointage.' : 'Could not load attendance.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  const punch = async (action: 'check_in' | 'check_out') => {
    setPunching(true);
    try {
      const locationId = punchLocationId === '_none' ? undefined : punchLocationId;
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, locationId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: language === 'fr' ? 'Action refusée' : 'Action denied',
          description: String(json.message ?? json.error ?? 'Erreur'),
          variant: 'destructive',
        });
        return;
      }
      toast({ title: language === 'fr' ? 'Succès' : 'Success', description: String(json.message ?? 'OK') });
      setBiometricVerified(false);
      await load();
    } finally {
      setPunching(false);
    }
  };

  const enrollBiometric = async () => {
    setBiometricBusy(true);
    try {
      const optionsRes = await fetch('/api/auth/webauthn/register-options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!optionsRes.ok) throw new Error('REGISTER_OPTIONS_FAILED');
      const options = await optionsRes.json();
      const attResp = await startRegistration(options);
      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp }),
      });
      if (!verifyRes.ok) throw new Error('REGISTER_VERIFY_FAILED');
      toast({
        title: language === 'fr' ? 'Biométrie activée' : 'Biometric enabled',
        description: language === 'fr' ? 'Votre appareil est enregistré.' : 'Your authenticator is now enrolled.',
      });
      await load();
    } catch {
      toast({
        title: language === 'fr' ? 'Échec biométrie' : 'Biometric setup failed',
        description:
          language === 'fr'
            ? 'Impossible d’enregistrer la biométrie sur cet appareil.'
            : 'Could not enroll biometric authentication on this device.',
        variant: 'destructive',
      });
    } finally {
      setBiometricBusy(false);
    }
  };

  const verifyBiometric = async () => {
    setBiometricBusy(true);
    try {
      const optionsRes = await fetch('/api/auth/webauthn/authenticate-options', {
        method: 'POST',
        credentials: 'include',
      });
      if (!optionsRes.ok) throw new Error('AUTH_OPTIONS_FAILED');
      const options = await optionsRes.json();
      const authResp = await startAuthentication(options);
      const verifyRes = await fetch('/api/auth/webauthn/authenticate-verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResp }),
      });
      if (!verifyRes.ok) throw new Error('AUTH_VERIFY_FAILED');
      setBiometricVerified(true);
      toast({
        title: language === 'fr' ? 'Vérification validée' : 'Verification successful',
        description:
          language === 'fr' ? 'Vous pouvez pointer dans les 2 minutes.' : 'You can now punch within 2 minutes.',
      });
    } catch {
      setBiometricVerified(false);
      toast({
        title: language === 'fr' ? 'Vérification refusée' : 'Verification failed',
        description:
          language === 'fr'
            ? 'La biométrie a échoué ou a été annulée.'
            : 'Biometric authentication failed or was canceled.',
        variant: 'destructive',
      });
    } finally {
      setBiometricBusy(false);
    }
  };

  const att = data?.attendance;
  const canCheckIn = !att?.checkIn;
  const canCheckOut = !!att?.checkIn && !att?.checkOut;

  const statusLabel = (s: string) => {
    if (s === 'present') return t('attendance.present');
    if (s === 'retard') return t('attendance.late');
    if (s === 'absent') return t('attendance.absent');
    return s;
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('attendance.punchTitle')}</h1>
        <p className="text-muted-foreground">{t('attendance.punchSubtitle')}</p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            <CardTitle>{t('attendance.todaySummary')}</CardTitle>
          </div>
          <CardDescription>
            {data?.date}
            {data?.timezone ? ` · ${data.timezone}` : ''}
            {data?.schedule && !data.schedule.workDay ? (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                {data.schedule.dayContext === 'public_holiday' && data.schedule.publicHolidayName
                  ? `${t('attendance.contextHoliday')}: ${data.schedule.publicHolidayName}`
                  : data.schedule.dayContext === 'on_leave'
                    ? `${t('attendance.contextLeave')}${
                        data.schedule.leaveType
                          ? ` (${t(`settings.leaveType.${data.schedule.leaveType}`)})`
                          : ''
                      }`
                    : data.schedule.dayContext === 'weekend'
                      ? t('attendance.contextWeekend')
                      : language === 'fr'
                        ? '(hors jours planifiés)'
                        : '(outside scheduled work days)'}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading || !data ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-medium">{t('attendance.schedule')}</p>
                <p className="text-muted-foreground">
                  {data.schedule.startTime} — {data.schedule.endTime}
                </p>
              </div>

              {att && (
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('attendance.status')}</span>
                    <Badge variant={att.status === 'retard' ? 'destructive' : 'secondary'}>
                      {statusLabel(att.status)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('attendance.checkInCol')}</span>
                    <span className="font-mono">
                      {att.checkIn ? format(new Date(att.checkIn), 'HH:mm:ss', { locale: fr }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">{t('attendance.locationIn')}</span>
                    <span className="text-right text-sm">{att.checkInLocation?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('attendance.checkOutCol')}</span>
                    <span className="font-mono">
                      {att.checkOut ? format(new Date(att.checkOut), 'HH:mm:ss', { locale: fr }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">{t('attendance.locationOut')}</span>
                    <span className="text-right text-sm">{att.checkOutLocation?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('attendance.worked')}</span>
                    <span className="font-medium">{formatWorked(att.workedMinutes)}</span>
                  </div>
                </div>
              )}

              {(canCheckIn || canCheckOut) && locations.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="punch-location">{t('attendance.locationOptional')}</Label>
                  <Select value={punchLocationId} onValueChange={setPunchLocationId}>
                    <SelectTrigger id="punch-location" className="w-full">
                      <SelectValue placeholder={t('attendance.locationNone')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('attendance.locationNone')}</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {biometricStatus.enrolled ? (
                  <Button
                    size="lg"
                    variant={biometricVerified ? 'default' : 'outline'}
                    className="h-14 text-base sm:col-span-2"
                    disabled={biometricBusy || punching}
                    onClick={() => void verifyBiometric()}
                  >
                    {biometricBusy ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : biometricVerified ? (
                      <ShieldCheck className="mr-2 h-5 w-5" />
                    ) : (
                      <Fingerprint className="mr-2 h-5 w-5" />
                    )}
                    {biometricVerified
                      ? language === 'fr'
                        ? 'Biométrie validée'
                        : 'Biometric verified'
                      : language === 'fr'
                        ? 'Valider biométrie (Face/Empreinte)'
                        : 'Verify biometrics (Face/Fingerprint)'}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 text-base sm:col-span-2"
                    disabled={biometricBusy || punching}
                    onClick={() => void enrollBiometric()}
                  >
                    {biometricBusy ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Fingerprint className="mr-2 h-5 w-5" />
                    )}
                    {language === 'fr'
                      ? 'Activer biométrie (Face/Empreinte)'
                      : 'Enable biometrics (Face/Fingerprint)'}
                  </Button>
                )}
                <Button
                  size="lg"
                  className="h-14 text-base"
                  disabled={!canCheckIn || punching || !biometricVerified}
                  onClick={() => void punch('check_in')}
                >
                  {punching && canCheckIn ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  {t('attendance.checkIn')}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-14 text-base"
                  disabled={!canCheckOut || punching || !biometricVerified}
                  onClick={() => void punch('check_out')}
                >
                  {punching && canCheckOut ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-5 w-5" />
                  )}
                  {t('attendance.checkOut')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
