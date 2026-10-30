'use client';

import { AlertTriangle, PlaneLanding, PlaneTakeoff, Play } from 'lucide-react';
import type { DgMission } from '@/lib/workspace/types';
import {
  isMissionReturningToday,
  missionNeedsStartPrompt,
} from '@/lib/workspace/mission-visual-state';
import {
  isMissionDepartingToday,
  isMissionDepartTodayVisualState,
} from '@/lib/workspace/mission-status-workflow';
import { cn } from '@/lib/utils';

type Props = {
  missions: DgMission[];
  onStartMission?: (mission: DgMission) => void;
  compact?: boolean;
};

function truncateSubject(subject: string, max = 28): string {
  return subject.length > max ? `${subject.slice(0, max)}…` : subject;
}

export function MissionAlertsBanner({ missions, onStartMission, compact }: Props) {
  const now = new Date();
  const active = missions.filter((m) => !m.archived && m.status !== 'CANCELLED');

  const departingToday = active.filter(
    (m) =>
      m.status === 'PLANNED'
        ? isMissionDepartTodayVisualState(m.departAt, now)
        : isMissionDepartingToday(m.departAt, now)
  );
  const returningToday = active.filter(
    (m) => isMissionReturningToday(m.returnAt, now) && m.status === 'ONGOING'
  );
  const needsStart = active.filter((m) => missionNeedsStartPrompt(m, now));

  const startTarget = needsStart[0];
  const canStart = Boolean(startTarget && onStartMission);

  const alertCount = departingToday.length + returningToday.length + needsStart.length;

  const todayMessages: string[] = [];
  if (departingToday.length > 0) {
    todayMessages.push(
      departingToday.length === 1
        ? `Départ aujourd'hui — ${truncateSubject(departingToday[0]!.subject)} (démarrage auto à 22h59)`
        : `${departingToday.length} départs aujourd'hui (démarrage auto à 22h59)`
    );
  }
  if (returningToday.length > 0) {
    todayMessages.push(
      returningToday.length === 1
        ? `Retour aujourd'hui — ${truncateSubject(returningToday[0]!.subject)} (clôture auto à 23h59)`
        : `${returningToday.length} retours aujourd'hui (clôture auto à 23h59)`
    );
  }

  const todayActive = todayMessages.length > 0;

  return (
    <section
      className={cn('mission-alerts-panel', compact && 'mission-alerts-panel--compact')}
      aria-label="Alertes et actions missions"
    >
      <div className="mission-alerts-panel-head">
        <span className="mission-alerts-panel-title">Suivi du jour</span>
        {alertCount > 0 ? (
          <span className="mission-alerts-panel-badge" aria-label={`${alertCount} alerte(s)`}>
            {alertCount}
          </span>
        ) : (
          <span className="mission-alerts-panel-badge mission-alerts-panel-badge--muted">0</span>
        )}
      </div>

      <div className="mission-alerts-stack">
        <div
          className={cn(
            'mission-alert-card',
            todayActive ? 'mission-alert-card--active' : 'mission-alert-card--idle',
            departingToday.length > 0 && 'mission-alert-card--depart',
            returningToday.length > 0 && !departingToday.length && 'mission-alert-card--return'
          )}
          role="status"
        >
          <div className="mission-alert-card-icon" aria-hidden>
            {returningToday.length > 0 && departingToday.length === 0 ? (
              <PlaneLanding className="h-4 w-4" />
            ) : (
              <PlaneTakeoff className="h-4 w-4" />
            )}
          </div>
          <div className="mission-alert-card-body">
            <p className="mission-alert-card-label">Événements du jour</p>
            {todayActive ? (
              <ul className="mission-alert-card-list">
                {todayMessages.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : (
              <p className="mission-alert-card-placeholder">Rien à signaler pour aujourd&apos;hui</p>
            )}
            {!compact && todayActive ? (
              <p className="mission-alert-card-detail">
                {[...departingToday, ...returningToday]
                  .map((m) => m.subject)
                  .filter((s, i, arr) => arr.indexOf(s) === i)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
          {todayActive ? (
            <AlertTriangle className="mission-alert-card-warn h-4 w-4 shrink-0" aria-hidden />
          ) : null}
        </div>

        <div
          className={cn(
            'mission-alert-card mission-alert-card--actions',
            canStart && 'mission-alert-card--active'
          )}
          role="group"
          aria-label="Actions rapides"
        >
          <div className="mission-alert-card-body mission-alert-card-body--actions">
            <p className="mission-alert-card-label">Actions rapides</p>
            <div className="mission-alert-action-group">
              <button
                type="button"
                className={cn(
                  'mission-alert-action-btn mission-alert-action-btn--start',
                  canStart && 'mission-alert-action-btn--available'
                )}
                disabled={!canStart}
                title={
                  canStart && startTarget
                    ? `Démarrer « ${startTarget.subject} » (sinon auto à 22h59)`
                    : 'Mission planifiée avec départ aujourd\'hui — démarrage auto à 22h59'
                }
                onClick={() => startTarget && onStartMission?.(startTarget)}
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                <span className="mission-alert-action-btn-text">
                  Démarrer
                  {needsStart.length > 1 ? (
                    <span className="mission-alert-action-count">{needsStart.length}</span>
                  ) : null}
                </span>
                {canStart && startTarget && !compact ? (
                  <span className="mission-alert-action-subject">{truncateSubject(startTarget.subject)}</span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
