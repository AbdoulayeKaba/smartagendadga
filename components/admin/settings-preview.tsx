'use client';

import { InstitutionLogoImage } from '@/components/layout/institution-logo-image';
import { Bell, Building2, Calendar, Globe, Shield, Zap } from 'lucide-react';
import type { PlatformConfig } from '@/lib/dg/platform-config';
import {
  DATE_TIME_FORMAT_OPTIONS,
  SYSTEM_LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/dg/institutional-options';

type Tab = 'general' | 'notifications' | 'security' | 'integrations';

export function SettingsPreviewPanel({
  settings,
  tab,
}: {
  settings: PlatformConfig;
  tab: Tab;
}) {
  const lang =
    SYSTEM_LANGUAGE_OPTIONS.find((o) => o.value === settings.systemLanguage)?.label ?? '—';
  const tz = TIMEZONE_OPTIONS.find((o) => o.value === settings.timezone)?.label ?? settings.timezone;
  const fmt =
    DATE_TIME_FORMAT_OPTIONS.find((o) => o.value === settings.dateTimeFormat)?.label ??
    settings.dateTimeFormat;
  const smtpOk = Boolean(settings.smtpHost?.trim() && settings.smtpFromEmail?.trim());

  return (
    <aside className="admin-settings-aside" aria-label="Aperçu de la configuration">
      <p className="admin-settings-aside-label">Aperçu en direct</p>

      <div className="admin-settings-preview-stack">
        <div className="admin-settings-preview-card">
          <div className="admin-settings-preview-hero">
            <div className="admin-settings-preview-logo">
              {settings.institutionLogoUrl ? (
                <InstitutionLogoImage
                  src={settings.institutionLogoUrl}
                  alt=""
                  className="h-full w-auto max-w-full object-contain"
                />
              ) : (
                <Building2 className="admin-settings-preview-logo-fallback" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="admin-settings-preview-title">
                {settings.organizationName || 'Institution'}
              </p>
              {settings.institutionAcronym ? (
                <p className="admin-settings-preview-acronym">{settings.institutionAcronym}</p>
              ) : null}
            </div>
          </div>

          <ul className="admin-settings-preview-list">
            {settings.institutionAddress ? (
              <li>
                <span className="truncate">{settings.institutionAddress}</span>
              </li>
            ) : null}
            <li>
              <Globe className="admin-settings-preview-icon" aria-hidden />
              <span className="truncate">
                {lang} · {tz.split(' ')[0]}
              </span>
            </li>
            <li>
              <Calendar className="admin-settings-preview-icon" aria-hidden />
              <span>{fmt}</span>
            </li>
          </ul>
        </div>

        {tab === 'notifications' ? (
          <div className="admin-settings-preview-card">
            <div className="admin-settings-preview-card-head">
              <Bell className="admin-settings-preview-head-icon" aria-hidden />
              <span className="admin-settings-preview-card-title">Email</span>
            </div>
            <span
              className="admin-settings-preview-pill"
              data-status={smtpOk ? 'ok' : 'warn'}
            >
              {smtpOk ? 'SMTP configuré' : 'SMTP incomplet'}
            </span>
            <p className="admin-settings-preview-meta">
              {settings.notifyNewAppointments ? 'RDV' : ''}
              {settings.notifyNewAppointments && settings.notifyAppointmentReminders ? ' · ' : ''}
              {settings.notifyAppointmentReminders ? 'Rappels' : ''}
            </p>
          </div>
        ) : null}

        {tab === 'security' ? (
          <div className="admin-settings-preview-card">
            <div className="admin-settings-preview-card-head">
              <Shield className="admin-settings-preview-head-icon" aria-hidden />
              <span className="admin-settings-preview-card-title">Sécurité</span>
            </div>
            <p className="admin-settings-preview-meta">
              MDP min. {settings.passwordMinLength} · session {settings.sessionExpirationMinutes} min
            </p>
            <p className="admin-settings-preview-meta">
              {settings.sessionSinglePerUser ? 'Session unique' : 'Sessions multiples'}
              {settings.twoFactorRequired ? ' · 2FA requis' : ''}
            </p>
          </div>
        ) : null}

        {tab === 'integrations' ? (
          <div className="admin-settings-preview-card">
            <div className="admin-settings-preview-card-head">
              <Zap className="admin-settings-preview-head-icon" aria-hidden />
              <span className="admin-settings-preview-card-title">Intégrations</span>
            </div>
            <p className="admin-settings-preview-meta">
              {settings.adImportSource === 'graph' ? 'Microsoft Entra ID' : 'LDAP on-premise'}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
