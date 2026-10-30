'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarSearch, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { AiGenerationMode, DailyAgendaResult } from '@/lib/ai/types';
import { DailyAgendaBriefing } from '@/components/dg/daily-agenda-briefing';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Date ciblée pour l'analyse (jour sélectionné du calendrier). */
  date: Date;
};

function ModeBadge({ mode }: { mode: AiGenerationMode }) {
  return (
    <span className={cn('dg-ai-mode-badge', mode === 'ai' && 'dg-ai-mode-badge--ai')}>
      <Sparkles className="h-3 w-3" aria-hidden />
      {mode === 'ai' ? 'Enrichie' : 'Standard'}
    </span>
  );
}

export function DailyAgendaAnalysisDialog({ open, onOpenChange, date }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mode: AiGenerationMode; data: DailyAgendaResult } | null>(
    null
  );

  const dateKey = format(date, 'yyyy-MM-dd');
  const dateLabel = format(date, 'EEEE d MMMM yyyy', { locale: fr });

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/agenda/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey }),
      });
      const raw = await res.text();
      let json: { mode?: AiGenerationMode; data?: DailyAgendaResult; message?: string } = {};
      if (raw.trim()) {
        try {
          json = JSON.parse(raw) as typeof json;
        } catch {
          setError('Réponse serveur invalide.');
          return;
        }
      }
      if (!res.ok) {
        const message =
          json.message ??
          (res.status === 401
            ? 'Session expirée — reconnectez-vous.'
            : res.status === 403
              ? 'Accès refusé — permission insuffisante pour analyser l’agenda.'
              : "L'analyse a échoué. Réessayez.");
        setError(message);
        toast({ variant: 'destructive', title: 'Analyse impossible', description: message });
        return;
      }
      if (!json.mode || !json.data) {
        setError('Données de briefing incomplètes.');
        return;
      }
      setResult({ mode: json.mode, data: json.data });
    } catch {
      const message = 'Erreur réseau — vérifiez votre connexion.';
      setError(message);
      toast({ variant: 'destructive', title: 'Analyse impossible', description: message });
    } finally {
      setLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    void runAnalysis();
  }, [open, runAnalysis]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dg-ai-analysis-dialog admin-theme" showCloseButton>
        <span className="dg-ai-analysis-dialog-accent" aria-hidden />
        <DialogHeader className="dg-ai-analysis-dialog-head">
          <div className="dg-ai-analysis-dialog-head-main">
            <span className="dg-ai-analysis-dialog-icon">
              <CalendarSearch className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="dg-ai-analysis-dialog-head-text">
              <DialogTitle className="dg-ai-analysis-dialog-title">
                Analyse de l&apos;agenda
              </DialogTitle>
              <DialogDescription className="dg-ai-analysis-dialog-date">
                {dateLabel}
              </DialogDescription>
            </div>
          </div>
          <div className="dg-ai-analysis-dialog-head-actions">
            {result ? <ModeBadge mode={result.mode} /> : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="dg-ai-analysis-dialog-refresh"
              onClick={() => void runAnalysis()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regénérer
            </Button>
          </div>
        </DialogHeader>

        <div className="dg-ai-analysis-dialog-toolbar">
          <span className="dg-ai-analysis-dialog-toolbar-hint">
            <Sparkles className="h-3 w-3" aria-hidden />
            Briefing opérationnel généré par l&apos;assistant
          </span>
        </div>

        <div className="dg-ai-analysis-dialog-body">
          {loading && !result ? (
            <div className="dg-ai-analysis-dialog-loading">
              <span className="dg-ai-analysis-dialog-spinner">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <p>Analyse de la journée en cours…</p>
              <div className="dg-ai-analysis-dialog-skeleton" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}

          {!loading && error && !result ? (
            <div className="dg-ai-analysis-dialog-error">
              <p>{error}</p>
              <Button
                type="button"
                size="sm"
                className="dg-ai-analysis-dialog-refresh"
                onClick={() => void runAnalysis()}
              >
                Réessayer
              </Button>
            </div>
          ) : null}

          {result ? (
            <DailyAgendaBriefing data={result.data} mode={result.mode} compact />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
