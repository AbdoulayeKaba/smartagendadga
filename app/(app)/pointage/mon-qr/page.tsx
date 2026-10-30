'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const QRCode = dynamic(() => import('react-qr-code').then((m) => m.default), { ssr: false });

export default function MonQrPage() {
  const { t, language } = useApp();
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchToken = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/attendance/qr-token', { credentials: 'include' });
      if (!res.ok) throw new Error('FAIL');
      const json = (await res.json()) as { token: string; expiresInSeconds: number };
      setToken(json.token);
      setExpiresIn(json.expiresInSeconds);
    } catch {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: t('qr.error'),
        variant: 'destructive',
      });
      setToken(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, t]);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      setExpiresIn((s) => {
        if (s <= 1) {
          void fetchToken();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [token, fetchToken]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('qr.title')}</h1>
        <p className="text-muted-foreground">{t('qr.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t('qr.title')}</CardTitle>
            <CardDescription>
              {t('qr.expires')} {loading ? '…' : `${expiresIn}${t('qr.seconds')}`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void fetchToken()}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{t('qr.refresh')}</span>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {loading && !token ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              {t('qr.loading')}
            </div>
          ) : token ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <QRCode value={token} size={220} level="M" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('qr.error')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
