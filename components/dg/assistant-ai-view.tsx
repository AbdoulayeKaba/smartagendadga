'use client';

import { useCallback, useState } from 'react';
import { CalendarRange, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgendaWeekPressure } from '@/lib/ai/types';
import { AgendaPressureBriefing } from '@/components/dg/agenda-pressure-briefing';
import { toast } from '@/hooks/use-toast';

export function AssistantAiView() {
  const [loading, setLoading] = useState(false);
  const [pressure, setPressure] = useState<AgendaWeekPressure | null>(null);
  const [agendaError, setAgendaError] = useState<string | null>(null);

  const runAgenda = useCallback(async () => {
    setLoading(true);
    setAgendaError(null);
    try {
      const res = await fetch('/api/ai/agenda/pressure', { method: 'POST' });
      const raw = await res.text();
      let json: { pressure?: AgendaWeekPressure; error?: string; message?: string } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as typeof json;
        } catch {
          setAgendaError('Réponse serveur invalide.');
          toast({
            variant: 'destructive',
            title: 'Génération impossible',
            description: 'Réponse serveur invalide.',
          });
          return;
        }
      }
      if (!res.ok) {
        const message =
          json.message ??
          (res.status === 401
            ? 'Session expirée — reconnectez-vous.'
            : res.status === 403
              ? 'Accès refusé — permission insuffisante pour générer le briefing.'
              : 'La lecture a échoué. Réessayez.');
        setAgendaError(message);
        toast({ variant: 'destructive', title: 'Lecture impossible', description: message });
        return;
      }
      if (!json.pressure) {
        setAgendaError('Données de lecture incomplètes.');
        return;
      }
      setPressure(json.pressure);
    } catch {
      const message = 'Erreur réseau — vérifiez votre connexion.';
      setAgendaError(message);
      toast({ variant: 'destructive', title: 'Lecture impossible', description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="dg-ai-view">
      <section className="dg-ai-panel">
        <header className="dg-ai-panel-head">
          <div className="min-w-0">
            <h2 className="dg-ai-panel-title">Lecture de la semaine</h2>
            <p className="dg-ai-panel-sub">
              Le jour est déjà dans le cockpit. Ici, la charge à venir et la tension des demandes.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="dg-ai-generate-btn shrink-0"
            onClick={() => void runAgenda()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Lire
          </Button>
        </header>
        {pressure ? (
          <div className="dg-ai-result dg-ai-result--agenda">
            <div className="dg-ai-result-head">
              <div className="min-w-0">
                <h3>{pressure.weekLabel}</h3>
                <p className="dg-ai-result-meta">Charge confirmée et rendez-vous en attente</p>
              </div>
            </div>
            <AgendaPressureBriefing data={pressure} />
          </div>
        ) : (
          <div className="dg-ai-empty-state">
            <CalendarRange aria-hidden />
            <p>
              Cliquez sur <strong>Lire</strong> pour voir la charge de la semaine.
            </p>
            {agendaError ? <p className="dg-ai-error">{agendaError}</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
