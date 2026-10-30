'use client';

import { BarChart3, Eye, EyeOff, Paperclip, Send } from 'lucide-react';
import type { MailAnalytics } from '@/lib/workspace/mail-analytics';

type Props = {
  analytics: MailAnalytics;
  year: number;
  visible: boolean;
  onToggleVisible: () => void;
  direction?: 'INCOMING' | 'OUTGOING';
};

export function MailChartsPanel({
  analytics,
  year,
  visible,
  onToggleVisible,
  direction = 'INCOMING',
}: Props) {
  const statusData = analytics.byStatus;
  const statusTotal = analytics.statusTotal;
  const flowPeak = analytics.monthlyFlow.reduce(
    (best, row) => (row.total > best.total ? row : best),
    analytics.monthlyFlow[0] ?? { total: 0, label: '', month: 0, urgent: 0 }
  );
  const maxMonth = Math.max(1, ...analytics.monthlyFlow.map((row) => row.total));
  const withPj = analytics.byAttachment.find((p) => p.key === 'WITH')?.value ?? 0;
  const withoutPj = analytics.byAttachment.find((p) => p.key === 'WITHOUT')?.value ?? 0;
  const flowLabel = direction === 'OUTGOING' ? 'Envois' : 'Réceptions';
  const pjRate = statusTotal > 0 ? Math.round((withPj / statusTotal) * 100) : 0;

  const toggle = (
    <button
      type="button"
      className="mail-charts-toggle-btn"
      onClick={onToggleVisible}
      aria-pressed={visible}
      aria-label={visible ? 'Masquer la synthèse' : 'Afficher la synthèse'}
    >
      {visible ? <EyeOff className="h-3 w-3" aria-hidden /> : <Eye className="h-3 w-3" aria-hidden />}
      {visible ? 'Masquer' : 'Afficher'}
    </button>
  );

  if (!visible) {
    return (
      <div className="mail-charts-wrap">
        <div className="mail-charts-toggle-bar">
          <span className="mail-charts-toggle-label">
            <BarChart3 className="h-3 w-3" aria-hidden />
            Synthèse courriers
          </span>
          {toggle}
        </div>
      </div>
    );
  }

  return (
    <section className="mail-insight" aria-label="Synthèse courriers">
      <header className="mail-insight-head">
        <span className="mail-charts-toggle-label">
          <BarChart3 className="h-3 w-3" aria-hidden />
          Synthèse {year}
        </span>
        {toggle}
      </header>

      <div className="mail-insight-kpis">
        <article className="mail-insight-kpi">
          <span className="mail-insight-kpi-value">{statusTotal}</span>
          <span className="mail-insight-kpi-label">
            {direction === 'OUTGOING' ? 'envoyés' : 'reçus'}
          </span>
        </article>
        <article className="mail-insight-kpi">
          <span className="mail-insight-kpi-value">{flowPeak.total}</span>
          <span className="mail-insight-kpi-label">pic {flowPeak.label || '—'}</span>
        </article>
        <article className="mail-insight-kpi">
          <span className="mail-insight-kpi-value">{pjRate}%</span>
          <span className="mail-insight-kpi-label">avec PJ</span>
        </article>
        {statusData.map((row) => (
          <article key={row.key} className="mail-insight-kpi mail-insight-kpi--status">
            <span className="mail-chart-legend-dot" style={{ background: row.fill }} />
            <span className="mail-insight-kpi-value">{row.value}</span>
            <span className="mail-insight-kpi-label">{row.label}</span>
          </article>
        ))}
      </div>

      <div className="mail-insight-year" aria-label={`${flowLabel} par mois`}>
        <span className="mail-insight-year-label">
          <Send className="h-3 w-3" aria-hidden />
          {flowLabel}
        </span>
        <ol className="mail-insight-months">
          {analytics.monthlyFlow.map((row) => {
            const level = row.total <= 0 ? 0 : Math.max(1, Math.ceil((row.total / maxMonth) * 4));
            return (
              <li
                key={row.month}
                className="mail-insight-month"
                data-level={level}
                data-peak={row.month === flowPeak.month && row.total > 0 ? 'true' : undefined}
                title={`${row.label} : ${row.total}`}
              >
                <strong>{row.total || '·'}</strong>
                <span>{row.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="mail-insight-pj-note">
          <Paperclip className="h-3 w-3" aria-hidden />
          {withPj} avec PJ · {withoutPj} sans PJ
        </p>
      </div>
    </section>
  );
}
