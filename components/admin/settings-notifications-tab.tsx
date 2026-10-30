'use client';

import { useState } from 'react';
import {
  Bell,
  CalendarClock,
  Loader2,
  Send,
} from 'lucide-react';
import {
  SettingsBanner,
  SettingsCard,
  SettingsCardBody,
  SettingsDivider,
  SettingsSectionTitle,
  SettingsField,
  SettingsFieldGrid,
  SettingsTestRow,
  SettingsToggleCard,
} from '@/components/admin/settings-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import type { PlatformConfig } from '@/lib/dg/platform-config';
import { SMTP_PASSWORD_MASK } from '@/lib/services/platform-settings-admin';

type Props = {
  settings: PlatformConfig;
  onChange: (s: PlatformConfig) => void;
};

export function SettingsNotificationsTab({ settings, onChange }: Props) {
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  const patch = (partial: Partial<PlatformConfig>) => onChange({ ...settings, ...partial });

  const setReminder = (v: boolean) =>
    patch({ notifyAppointmentReminders: v, reminderEmailEnabled: v });

  const smtpOk = Boolean(settings.smtpHost?.trim() && settings.smtpFromEmail?.trim());
  const mockDataMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  const testEmail = async () => {
    if (!testTo.trim()) {
      toast({ variant: 'destructive', title: 'Indiquez un destinataire de test.' });
      return;
    }
    const hasStoredPassword = settings.smtpPassword === SMTP_PASSWORD_MASK;
    const hasTypedPassword =
      Boolean(settings.smtpPassword?.trim()) &&
      settings.smtpPassword !== SMTP_PASSWORD_MASK;
    if (!hasStoredPassword && !hasTypedPassword) {
      toast({
        variant: 'destructive',
        title: 'Mot de passe SMTP requis',
        description:
          'Saisissez le mot de passe d’application Gmail dans le champ Mot de passe, puis réessayez.',
      });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testTo.trim(),
          smtp: {
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpSecure: settings.smtpSecure,
            smtpUser: settings.smtpUser,
            smtpPassword: hasTypedPassword ? settings.smtpPassword : undefined,
            smtpFromEmail: settings.smtpFromEmail,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiError = String(j.error ?? '');
        const description =
          apiError === 'UNAUTHORIZED'
            ? 'Session expirée ou invalide. Déconnectez-vous, reconnectez-vous (assistante@organisation.local), puis réessayez.'
            : apiError === 'FORBIDDEN'
              ? 'Votre rôle n’a pas la permission d’envoyer un test SMTP.'
              : apiError || 'Vérifiez la configuration SMTP.';
        toast({
          variant: 'destructive',
          title: 'Échec du test',
          description,
        });
        return;
      }
      toast({ title: j.message ?? 'Email de test envoyé.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="admin-settings-tab-content">
      {mockDataMode ? (
        <SettingsBanner
          variant="warning"
          title="Mode démo actif pour les notifications automatiques"
          description="Le bouton « Envoyer un test » utilise toutefois le vrai SMTP si les identifiants sont renseignés. Pour les RDV et rappels, mettez USE_MOCK_DATA=false dans .env."
        />
      ) : null}

      <SettingsBanner
        variant={smtpOk ? 'orange' : 'warning'}
        title={smtpOk ? 'SMTP configuré' : 'Configuration SMTP incomplète'}
        description={
          smtpOk
            ? 'Gmail : utilisez un mot de passe d’application (pas celui du compte). Port 587 recommandé — laissez TLS désactivé (connexion STARTTLS).'
            : 'Indiquez au minimum le serveur SMTP et l’adresse expéditeur pour activer l’envoi.'
        }
      />

      <SettingsCard>
        <SettingsCardBody>
          <SettingsSectionTitle title="Configuration email" />
          <div className="space-y-4">
          <SettingsFieldGrid>
            <SettingsField label="Serveur SMTP" htmlFor="smtpHost">
              <Input
                id="smtpHost"
                className="admin-settings-input"
                placeholder="smtp.organisation.com"
                value={settings.smtpHost}
                onChange={(e) => patch({ smtpHost: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="Port" htmlFor="smtpPort">
              <Input
                id="smtpPort"
                type="number"
                min={1}
                max={65535}
                className="admin-settings-input admin-settings-input-port"
                value={settings.smtpPort}
                onChange={(e) => patch({ smtpPort: Number(e.target.value) || 587 })}
              />
            </SettingsField>
          </SettingsFieldGrid>

          <div className="admin-settings-inline-toggle">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">SMTP sécurisé (TLS)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gmail port 587 : laissez désactivé (STARTTLS). Port 465 : activez (SSL).
              </p>
            </div>
            <Switch
              checked={settings.smtpSecure}
              onCheckedChange={(v) => patch({ smtpSecure: v })}
              className="admin-settings-switch"
            />
          </div>

          <SettingsFieldGrid>
            <SettingsField label="Utilisateur" htmlFor="smtpUser">
              <Input
                id="smtpUser"
                type="email"
                className="admin-settings-input"
                placeholder="notifications@organisation.com"
                value={settings.smtpUser}
                onChange={(e) => patch({ smtpUser: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="Mot de passe" htmlFor="smtpPassword">
              <Input
                id="smtpPassword"
                type="password"
                className="admin-settings-input"
                placeholder={
                  settings.smtpPassword === SMTP_PASSWORD_MASK ? '••••••••' : 'Mot de passe'
                }
                value={settings.smtpPassword === SMTP_PASSWORD_MASK ? '' : settings.smtpPassword}
                onChange={(e) => patch({ smtpPassword: e.target.value })}
              />
            </SettingsField>
          </SettingsFieldGrid>

          <SettingsField label="Email expéditeur" htmlFor="smtpFromEmail">
            <Input
              id="smtpFromEmail"
              type="email"
              className="admin-settings-input max-w-lg"
              placeholder="noreply@organisation.com"
              value={settings.smtpFromEmail}
              onChange={(e) => patch({ smtpFromEmail: e.target.value })}
            />
          </SettingsField>

          <SettingsDivider />

          <SettingsTestRow label="Vérifier la configuration">
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Input
                type="email"
                className="admin-settings-input flex-1"
                placeholder="Destinataire de test"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button
                type="button"
                className="admin-btn-primary admin-settings-test-btn shrink-0 self-start sm:self-auto"
                disabled={testing}
                onClick={() => void testEmail()}
              >
                {testing ? <Loader2 className="animate-spin" /> : <Send />}
                Envoyer un test
              </Button>
            </div>
          </SettingsTestRow>
          </div>
        </SettingsCardBody>
      </SettingsCard>

      <div>
        <div className="admin-settings-section-heading">
          <Bell className="h-4 w-4" />
          <span>Notifications système</span>
        </div>
        <div className="admin-settings-toggle-grid">
          <SettingsToggleCard
            icon={CalendarClock}
            title="Nouveaux rendez-vous"
            description="Informer l’assistante et le DGA des nouvelles demandes"
            checked={settings.notifyNewAppointments}
            onCheckedChange={(v) => patch({ notifyNewAppointments: v })}
          />
          <SettingsToggleCard
            icon={Bell}
            title="Rappels automatiques"
            description="Emails de rappel avant chaque rendez-vous confirmé"
            checked={settings.notifyAppointmentReminders}
            onCheckedChange={setReminder}
          />
        </div>
      </div>
    </div>
  );
}
