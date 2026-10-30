'use client';

import { Clock, KeyRound } from 'lucide-react';
import {
  SettingsCard,
  SettingsCardBody,
  SettingsDivider,
  SettingsField,
  SettingsFieldGrid,
  SettingsSectionTitle,
  SettingsToggleRow,
} from '@/components/admin/settings-ui';
import { Input } from '@/components/ui/input';
import type { PlatformConfig } from '@/lib/dg/platform-config';

type Props = {
  settings: PlatformConfig;
  onChange: (s: PlatformConfig) => void;
};

export function SettingsSecurityTab({ settings, onChange }: Props) {
  const patch = (partial: Partial<PlatformConfig>) => onChange({ ...settings, ...partial });

  return (
    <div className="admin-settings-tab-content space-y-4">
      <SettingsCard>
        <SettingsCardBody>
          <div className="admin-settings-section-head">
            <KeyRound className="admin-settings-section-head-icon" aria-hidden />
            <SettingsSectionTitle title="Politique de mot de passe" />
          </div>

          <SettingsFieldGrid>
            <SettingsField label="Longueur minimale" htmlFor="passwordMinLength">
              <Input
                id="passwordMinLength"
                type="number"
                min={6}
                max={128}
                className="admin-settings-input"
                value={settings.passwordMinLength}
                onChange={(e) =>
                  patch({ passwordMinLength: Math.max(6, Number(e.target.value) || 10) })
                }
              />
            </SettingsField>
            <SettingsField label="Expiration (jours)" htmlFor="passwordExpirationDays">
              <Input
                id="passwordExpirationDays"
                type="number"
                min={0}
                max={3650}
                className="admin-settings-input"
                value={settings.passwordExpirationDays}
                onChange={(e) =>
                  patch({ passwordExpirationDays: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </SettingsField>
          </SettingsFieldGrid>

          <SettingsDivider />

          <div className="admin-settings-toggle-list">
            <SettingsToggleRow
              title="Majuscules requises"
              checked={settings.passwordRequireUppercase}
              onCheckedChange={(v) => patch({ passwordRequireUppercase: v })}
            />
            <SettingsToggleRow
              title="Chiffres requis"
              checked={settings.passwordRequireNumbers}
              onCheckedChange={(v) => patch({ passwordRequireNumbers: v })}
            />
            <SettingsToggleRow
              title="Caractères spéciaux requis"
              checked={settings.passwordRequireSpecialChars}
              onCheckedChange={(v) => patch({ passwordRequireSpecialChars: v })}
            />
            <SettingsToggleRow
              title="Minuscules requises"
              checked={settings.passwordRequireLowercase}
              onCheckedChange={(v) => patch({ passwordRequireLowercase: v })}
            />
          </div>
        </SettingsCardBody>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardBody>
          <div className="admin-settings-section-head">
            <Clock className="admin-settings-section-head-icon" aria-hidden />
            <SettingsSectionTitle title="Sessions" />
          </div>

          <SettingsField
            label="Expiration de session (minutes)"
            htmlFor="sessionExpirationMinutes"
          >
            <Input
              id="sessionExpirationMinutes"
              type="number"
              min={5}
              max={1440}
              className="admin-settings-input max-w-[8rem]"
              value={settings.sessionExpirationMinutes}
              onChange={(e) =>
                patch({
                  sessionExpirationMinutes: Math.max(5, Number(e.target.value) || 15),
                })
              }
            />
          </SettingsField>

          <SettingsDivider />

          <div className="admin-settings-toggle-list">
            <SettingsToggleRow
              title="Session unique par utilisateur"
              description="Déconnecter les autres sessions lors d'une nouvelle connexion"
              checked={settings.sessionSinglePerUser}
              onCheckedChange={(v) => patch({ sessionSinglePerUser: v })}
            />
            <SettingsToggleRow
              title="Authentification à deux facteurs"
              description="Rendre obligatoire pour tous les utilisateurs (connexion Microsoft ou biométrie)"
              checked={settings.twoFactorRequired}
              onCheckedChange={(v) => patch({ twoFactorRequired: v })}
            />
          </div>
        </SettingsCardBody>
      </SettingsCard>
    </div>
  );
}
