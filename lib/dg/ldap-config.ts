import type { DgRole } from '@/lib/dg/rbac';

export type AdImportSource = 'graph' | 'ldap';

export type LdapConnectionConfig = {
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter: string;
  defaultRole: DgRole;
  tlsRejectUnauthorized: boolean;
};

export const DEFAULT_LDAP_USER_FILTER =
  '(&(objectClass=user)(objectCategory=person)(mail=*)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';

export const DEFAULT_LDAP_CONFIG: Omit<LdapConnectionConfig, 'bindPassword'> = {
  url: 'ldaps://dc.organisation.local:636',
  bindDn: 'CN=svc-ldap,OU=Service Accounts,DC=organisation,DC=local',
  baseDn: 'OU=Utilisateurs,DC=organisation,DC=local',
  userFilter: DEFAULT_LDAP_USER_FILTER,
  defaultRole: 'MANAGER',
  tlsRejectUnauthorized: true,
};

export type LdapSettingsSlice = {
  ldapUrl: string;
  ldapBindDn: string;
  ldapBaseDn: string;
  ldapUserFilter: string;
  ldapDefaultRole: DgRole;
  ldapTlsRejectUnauthorized: boolean;
};

export function resolveLdapBindPassword(bindPassword?: string | null): string {
  const trimmed = bindPassword?.trim();
  if (trimmed) return trimmed;
  return process.env.LDAP_BIND_PASSWORD?.trim() ?? '';
}

export function mergeLdapConnectionConfig(
  settings: LdapSettingsSlice,
  overrides?: Partial<Omit<LdapConnectionConfig, 'bindPassword'>> & { bindPassword?: string }
): LdapConnectionConfig {
  return {
    url: overrides?.url?.trim() || settings.ldapUrl.trim(),
    bindDn: overrides?.bindDn?.trim() || settings.ldapBindDn.trim(),
    bindPassword: resolveLdapBindPassword(overrides?.bindPassword),
    baseDn: overrides?.baseDn?.trim() || settings.ldapBaseDn.trim(),
    userFilter:
      overrides?.userFilter?.trim() ||
      settings.ldapUserFilter.trim() ||
      DEFAULT_LDAP_CONFIG.userFilter,
    defaultRole: overrides?.defaultRole ?? settings.ldapDefaultRole,
    tlsRejectUnauthorized: overrides?.tlsRejectUnauthorized ?? settings.ldapTlsRejectUnauthorized,
  };
}

export type AdDirectoryUser = {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: DgRole;
  alreadyExists?: boolean;
};

export function parseLdapConfigFromSettings(
  raw: Record<string, string>
): Omit<LdapConnectionConfig, 'bindPassword'> {
  return {
    url: raw.ldapUrl ?? DEFAULT_LDAP_CONFIG.url,
    bindDn: raw.ldapBindDn ?? DEFAULT_LDAP_CONFIG.bindDn,
    baseDn: raw.ldapBaseDn ?? DEFAULT_LDAP_CONFIG.baseDn,
    userFilter: raw.ldapUserFilter ?? DEFAULT_LDAP_CONFIG.userFilter,
    defaultRole: (raw.ldapDefaultRole as DgRole) ?? DEFAULT_LDAP_CONFIG.defaultRole,
    tlsRejectUnauthorized: raw.ldapTlsRejectUnauthorized !== 'false',
  };
}

export function ldapSettingsToRecord(
  config: Partial<LdapConnectionConfig> & { ldapEnabled?: boolean; adImportSource?: AdImportSource }
): Record<string, string> {
  const out: Record<string, string> = {};
  if (config.ldapEnabled !== undefined) out.ldapEnabled = config.ldapEnabled ? 'true' : 'false';
  if (config.adImportSource) out.adImportSource = config.adImportSource;
  if (config.url) out.ldapUrl = config.url;
  if (config.bindDn) out.ldapBindDn = config.bindDn;
  if (config.baseDn) out.ldapBaseDn = config.baseDn;
  if (config.userFilter) out.ldapUserFilter = config.userFilter;
  if (config.defaultRole) out.ldapDefaultRole = config.defaultRole;
  if (config.tlsRejectUnauthorized !== undefined) {
    out.ldapTlsRejectUnauthorized = config.tlsRejectUnauthorized ? 'true' : 'false';
  }
  return out;
}
