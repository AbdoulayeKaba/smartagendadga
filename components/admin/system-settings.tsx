'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstitutionLogoImage } from '@/components/layout/institution-logo-image';
import {
  Bell,
  Building2,
  Loader2,
  Save,
  Settings,
  Settings2,
  Shield,
  Upload,
  Zap,
} from 'lucide-react';
import { SettingsNotificationsTab } from '@/components/admin/settings-notifications-tab';
import { SettingsSecurityTab } from '@/components/admin/settings-security-tab';
import { SettingsPreviewPanel } from '@/components/admin/settings-preview';
import {
  SettingsCard,
  SettingsCardBody,
  SettingsDivider,
  SettingsSectionTitle,
  SettingsField,
  SettingsFieldGrid,
} from '@/components/admin/settings-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import {
  DATE_TIME_FORMAT_OPTIONS,
  LOGO_ACCEPT,
  LOGO_MAX_BYTES,
  SYSTEM_LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/dg/institutional-options';
import type { PlatformConfig } from '@/lib/dg/platform-config';
import { pickPlatformBranding } from '@/lib/dg/platform-branding';
import { sanitizeSettingsPatch } from '@/lib/dg/settings-validation';
import {
  canAccessSettingsTab,
  firstAccessibleSettingsTab,
  type SettingsTabId,
} from '@/lib/dg/settings-tab-permissions';

type SettingsTab = SettingsTabId;

const TABS: {
  id: SettingsTab;
  label: string;
  icon: typeof Settings;
  blurb: string;
}[] = [
  { id: 'general', label: 'Général', icon: Settings, blurb: 'Identité & régionalisation' },
  { id: 'notifications', label: 'Notifications', icon: Bell, blurb: 'SMTP & alertes' },
  { id: 'security', label: 'Sécurité', icon: Shield, blurb: 'Mots de passe & sessions' },
  { id: 'integrations', label: 'Intégrations', icon: Zap, blurb: 'Annuaire & LDAP' },
];

export function SystemSettings() {
  const router = useRouter();
  const { permissions, updateBranding } = useApp();
  const visibleTabs = useMemo(
    () => TABS.filter((t) => canAccessSettingsTab(permissions, t.id)),
    [permissions]
  );
  const [settings, setSettings] = useState<PlatformConfig | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEditCurrentTab = canAccessSettingsTab(permissions, tab);

  useEffect(() => {
    if (canAccessSettingsTab(permissions, tab)) return;
    const next = firstAccessibleSettingsTab(permissions);
    if (next) setTab(next);
  }, [permissions, tab]);

  useEffect(() => {
    void fetch('/api/admin/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.settings) {
          setSettings(j.settings);
          setInitial(JSON.stringify(j.settings));
        }
      });
  }, []);

  const isDirty = settings && initial && JSON.stringify(settings) !== initial;

  const save = async () => {
    if (!settings || !canEditCurrentTab) return;
    setSaving(true);
    try {
      const payload = sanitizeSettingsPatch(settings as unknown as Record<string, unknown>);
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const description =
          j.error === 'VALIDATION_ERROR'
            ? 'Vérifiez les champs du formulaire (site web, emails, etc.).'
            : j.error === 'FORBIDDEN'
              ? 'Vous n’avez pas la permission d’enregistrer ces paramètres.'
              : 'Une erreur serveur est survenue. Réessayez.';
        toast({ variant: 'destructive', title: 'Enregistrement échoué', description });
        return;
      }
      setSettings(j.settings);
      setInitial(JSON.stringify(j.settings));
      updateBranding(pickPlatformBranding(j.settings));
      router.refresh();
      toast({ title: 'Paramètres enregistrés' });
    } finally {
      setSaving(false);
    }
  };

  const onLogoPick = (file: File | undefined) => {
    if (!file || !settings || !canAccessSettingsTab(permissions, 'general')) return;
    if (file.size > LOGO_MAX_BYTES) {
      toast({
        variant: 'destructive',
        title: 'Fichier trop volumineux',
        description: 'Taille maximale : 2 Mo.',
      });
      return;
    }
    setLogoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    void fetch('/api/admin/settings/logo', { method: 'POST', body: formData })
      .then(async (res) => {
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Logo non enregistré',
            description: 'Vérifiez le format (PNG, JPG, SVG, WEBP) et réessayez.',
          });
          return;
        }
        const json = (await res.json()) as { logoUrl?: string };
        if (!json.logoUrl) return;
        const next = { ...settings, institutionLogoUrl: json.logoUrl };
        setSettings(next);
        setInitial(JSON.stringify(next));
        setLogoFileName(file.name);
        updateBranding({ institutionLogoUrl: json.logoUrl });
        router.refresh();
        toast({ title: 'Logo enregistré' });
      })
      .finally(() => setLogoUploading(false));
  };

  const onLogoRemove = () => {
    if (!settings || !canAccessSettingsTab(permissions, 'general')) return;
    setLogoUploading(true);
    void fetch('/api/admin/settings/logo', { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) {
          toast({ variant: 'destructive', title: 'Suppression impossible' });
          return;
        }
        const next = { ...settings, institutionLogoUrl: '' };
        setSettings(next);
        setInitial(JSON.stringify(next));
        setLogoFileName(null);
        updateBranding({ institutionLogoUrl: '' });
        router.refresh();
        toast({ title: 'Logo retiré' });
      })
      .finally(() => setLogoUploading(false));
  };

  if (!settings) {
    return (
      <div className="admin-theme admin-settings-page">
        <div className="admin-settings-skeleton-shell">
          <div className="admin-settings-skeleton-topbar" />
          <div className="admin-settings-skeleton-nav" />
          <div className="admin-settings-skeleton-content">
            <div className="admin-settings-skeleton-card h-52" />
            <div className="admin-settings-skeleton-aside hidden lg:block" />
          </div>
        </div>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="admin-theme admin-settings-page">
        <div className="admin-settings-shell">
          <p className="text-sm text-muted-foreground p-6">
            Aucun onglet des paramètres n’est autorisé pour votre rôle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-theme admin-settings-page pb-28">
      <div className="admin-settings-shell">
        <header className="admin-settings-topbar">
          <div className="admin-settings-topbar-brand">
            <span className="admin-settings-topbar-icon">
              <Settings2 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h1 className="admin-settings-topbar-title">Paramètres système</h1>
              <p className="admin-settings-topbar-subtitle">Configuration globale de la plateforme</p>
            </div>
          </div>
          <div className="admin-settings-topbar-actions">
            {isDirty ? (
              <span className="admin-settings-dirty-badge">
                <span className="admin-settings-dirty-dot" aria-hidden />
                Non enregistré
              </span>
            ) : (
              <span className="admin-settings-status-badge">À jour</span>
            )}
            {canEditCurrentTab ? (
              <button
                type="button"
                className="admin-btn-primary admin-settings-save-btn"
                disabled={saving || !isDirty}
                onClick={() => void save()}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-3 w-3" aria-hidden />
                )}
                Enregistrer
              </button>
            ) : null}
          </div>
        </header>

        <nav className="admin-settings-nav" role="tablist" aria-label="Sections des paramètres">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                data-active={tab === t.id}
                className="admin-settings-nav-item"
                onClick={() => setTab(t.id)}
              >
                <span className="admin-settings-nav-icon">
                  <Icon aria-hidden />
                </span>
                <span className="admin-settings-nav-text">
                  <span className="admin-settings-nav-label">{t.label}</span>
                  <span className="admin-settings-nav-blurb">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="admin-settings-content">
          <div className="admin-settings-panel">
              {tab === 'notifications' ? (
            <SettingsNotificationsTab settings={settings} onChange={setSettings} />
          ) : tab === 'security' ? (
            <SettingsSecurityTab settings={settings} onChange={setSettings} />
          ) : tab === 'general' ? (
            <div className="admin-settings-tab-content">
              <SettingsCard>
                <SettingsCardBody>
                  <SettingsSectionTitle title="Identité de l'institution" />
                  <div className="admin-settings-identity-fields">
                  <SettingsField label="Nom de l'institution" htmlFor="organizationName">
                    <Input
                      id="organizationName"
                      className="admin-settings-input"
                      value={settings.organizationName}
                      onChange={(e) =>
                        setSettings({ ...settings, organizationName: e.target.value })
                      }
                    />
                  </SettingsField>

                  <SettingsFieldGrid>
                    <SettingsField label="Sigle" htmlFor="institutionAcronym">
                      <Input
                        id="institutionAcronym"
                        className="admin-settings-input"
                        placeholder="Ex. CDG"
                        value={settings.institutionAcronym}
                        onChange={(e) =>
                          setSettings({ ...settings, institutionAcronym: e.target.value })
                        }
                      />
                    </SettingsField>
                    <SettingsField label="Site web" htmlFor="institutionWebsite">
                      <Input
                        id="institutionWebsite"
                        type="url"
                        className="admin-settings-input"
                        placeholder="https://"
                        value={settings.institutionWebsite}
                        onChange={(e) =>
                          setSettings({ ...settings, institutionWebsite: e.target.value })
                        }
                      />
                    </SettingsField>
                  </SettingsFieldGrid>

                  <SettingsField
                    label="Logo de l'institution"
                    hint="PNG, JPG, SVG, WEBP — max. 2 Mo"
                  >
                    <div className="admin-settings-logo-zone">
                      <div className="admin-settings-logo-preview">
                        {settings.institutionLogoUrl ? (
                          <InstitutionLogoImage
                            src={settings.institutionLogoUrl}
                            alt="Logo"
                            className="h-full w-auto max-w-full object-contain"
                          />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
                        )}
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept={LOGO_ACCEPT}
                        className="hidden"
                        onChange={(e) => onLogoPick(e.target.files?.[0])}
                      />
                      <div className="admin-settings-logo-toolbar">
                        <Button
                          type="button"
                          variant="outline"
                          className="admin-settings-logo-btn admin-settings-logo-btn--outline"
                          disabled={logoUploading}
                          onClick={() => fileRef.current?.click()}
                        >
                          {logoUploading ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <Upload className="h-3 w-3" aria-hidden />
                          )}
                          Choisir
                        </Button>
                        {settings.institutionLogoUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="admin-settings-logo-btn admin-settings-logo-btn--ghost"
                            disabled={logoUploading}
                            onClick={onLogoRemove}
                          >
                            Retirer
                          </Button>
                        ) : null}
                        {logoFileName ? (
                          <span className="admin-settings-logo-filename">{logoFileName}</span>
                        ) : null}
                      </div>
                    </div>
                  </SettingsField>
                  </div>

                  <SettingsDivider />

                  <SettingsSectionTitle title="Coordonnées" />
                  <SettingsField label="Adresse" htmlFor="institutionAddress">
                    <Input
                      id="institutionAddress"
                      className="admin-settings-input"
                      value={settings.institutionAddress}
                      onChange={(e) =>
                        setSettings({ ...settings, institutionAddress: e.target.value })
                      }
                    />
                  </SettingsField>

                  <SettingsDivider />

                  <SettingsSectionTitle title="Régionalisation" />
                  <SettingsFieldGrid>
                    <SettingsField label="Langue du système">
                      <Select
                        value={settings.systemLanguage}
                        onValueChange={(v) =>
                          setSettings({
                            ...settings,
                            systemLanguage: v as PlatformConfig['systemLanguage'],
                          })
                        }
                      >
                        <SelectTrigger className="admin-settings-input h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_LANGUAGE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Fuseau horaire">
                      <Select
                        value={settings.timezone}
                        onValueChange={(v) => setSettings({ ...settings, timezone: v })}
                      >
                        <SelectTrigger className="admin-settings-input h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField
                      label="Format de date et heure"
                      className="sm:col-span-2"
                    >
                      <Select
                        value={settings.dateTimeFormat}
                        onValueChange={(v) =>
                          setSettings({
                            ...settings,
                            dateTimeFormat: v as PlatformConfig['dateTimeFormat'],
                          })
                        }
                      >
                        <SelectTrigger className="admin-settings-input h-11 max-w-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_TIME_FORMAT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsField>
                  </SettingsFieldGrid>
                </SettingsCardBody>
              </SettingsCard>
            </div>
          ) : (
            <div className="admin-settings-tab-content">
              <SettingsCard>
                <SettingsCardBody>
                  <SettingsSectionTitle title="Annuaire Active Directory" />
                  <div className="space-y-4">
                  <SettingsFieldGrid>
                    <SettingsField label="Source d'import par défaut">
                      <Select
                        value={settings.adImportSource}
                        onValueChange={(v) =>
                          setSettings({ ...settings, adImportSource: v as 'graph' | 'ldap' })
                        }
                      >
                        <SelectTrigger className="admin-settings-input h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="graph">Microsoft Entra ID</SelectItem>
                          <SelectItem value="ldap">LDAP on-premise</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                    <SettingsField label="Rôle LDAP par défaut">
                      <Select
                        value={settings.ldapDefaultRole}
                        onValueChange={(v) =>
                          setSettings({
                            ...settings,
                            ldapDefaultRole: v as PlatformConfig['ldapDefaultRole'],
                          })
                        }
                      >
                        <SelectTrigger className="admin-settings-input h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANAGER">MANAGER</SelectItem>
                          <SelectItem value="EXTERNAL">EXTERNAL</SelectItem>
                          <SelectItem value="DG">DGA</SelectItem>
                          <SelectItem value="ASSISTANT">ASSISTANT</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsField>
                  </SettingsFieldGrid>

                  {settings.adImportSource === 'ldap' ? (
                    <>
                      <SettingsDivider />
                      <SettingsFieldGrid>
                        <SettingsField
                          label="URL LDAP(S)"
                          htmlFor="ldapUrl"
                          className="sm:col-span-2"
                        >
                          <Input
                            id="ldapUrl"
                            className="admin-settings-input font-mono text-sm"
                            value={settings.ldapUrl}
                            onChange={(e) =>
                              setSettings({ ...settings, ldapUrl: e.target.value })
                            }
                          />
                        </SettingsField>
                        <SettingsField label="Bind DN" htmlFor="ldapBindDn">
                          <Input
                            id="ldapBindDn"
                            className="admin-settings-input font-mono text-xs"
                            value={settings.ldapBindDn}
                            onChange={(e) =>
                              setSettings({ ...settings, ldapBindDn: e.target.value })
                            }
                          />
                        </SettingsField>
                        <SettingsField label="Base DN" htmlFor="ldapBaseDn">
                          <Input
                            id="ldapBaseDn"
                            className="admin-settings-input font-mono text-xs"
                            value={settings.ldapBaseDn}
                            onChange={(e) =>
                              setSettings({ ...settings, ldapBaseDn: e.target.value })
                            }
                          />
                        </SettingsField>
                        <SettingsField
                          label="Filtre LDAP"
                          htmlFor="ldapUserFilter"
                          className="sm:col-span-2"
                        >
                          <Input
                            id="ldapUserFilter"
                            className="admin-settings-input font-mono text-xs"
                            value={settings.ldapUserFilter}
                            onChange={(e) =>
                              setSettings({ ...settings, ldapUserFilter: e.target.value })
                            }
                          />
                        </SettingsField>
                      </SettingsFieldGrid>
                      <p className="admin-settings-hint">
                        Mot de passe de liaison : saisi à l&apos;import sur la page Utilisateurs, ou
                        variable <code className="rounded bg-muted px-1">LDAP_BIND_PASSWORD</code>{' '}
                        dans .env.
                      </p>
                    </>
                  ) : null}
                  </div>
                </SettingsCardBody>
              </SettingsCard>
            </div>
          )}
          </div>

          <SettingsPreviewPanel settings={settings} tab={tab} />
        </div>
      </div>
    </div>
  );
}
