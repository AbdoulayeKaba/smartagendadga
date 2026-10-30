import type { AdDirectoryUser, AdImportSource, LdapConnectionConfig } from '@/lib/dg/ldap-config';
import { mergeLdapConnectionConfig } from '@/lib/dg/ldap-config';
import type { DgRole } from '@/lib/dg/rbac';
import { isMockDataEnabled } from '@/lib/mock/config';
import { MOCK_AD_DIRECTORY } from '@/lib/mock/ad-directory';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import { createUser, listUsers } from '@/lib/services/users-admin';
import { getMicrosoftGraphToken, isMicrosoftDirectoryConfigured } from '@/lib/services/graph-token';
import { mockWriteAudit } from '@/lib/mock/audit';
import { writeAudit } from '@/lib/services/appointments';

function resolveRoleFromEnv(email: string, defaultRole: DgRole): DgRole {
  const dgEmails = (process.env.AZURE_DG_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
  const assistantEmails = (process.env.AZURE_ASSISTANT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  const externalDomains = (process.env.AZURE_EXTERNAL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (dgEmails.includes(email)) return 'DG';
  if (assistantEmails.includes(email)) return 'ASSISTANT';
  const domain = email.split('@')[1] ?? '';
  if (externalDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'EXTERNAL';
  return defaultRole;
}

async function markExisting(users: AdDirectoryUser[]): Promise<AdDirectoryUser[]> {
  const existing = await listUsers();
  const emails = new Set(existing.map((u) => u.email.toLowerCase()));
  return users.map((u) => ({
    ...u,
    alreadyExists: emails.has(u.email.toLowerCase()),
  }));
}

export async function fetchGraphDirectoryUsers(
  defaultRole: DgRole
): Promise<{ ok: true; users: AdDirectoryUser[] } | { ok: false; error: string }> {
  const token = await getMicrosoftGraphToken();
  if (!token) {
    return { ok: false, error: 'GRAPH_NOT_CONFIGURED' };
  }

  const users: AdDirectoryUser[] = [];
  let url: string | null =
    'https://graph.microsoft.com/v1.0/users?$select=id,mail,userPrincipalName,givenName,surname,department,accountEnabled&$top=100&$filter=accountEnabled eq true';

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { ok: false as const, error: 'GRAPH_FETCH_FAILED' as const };
    }
    const json = (await res.json()) as {
      value?: {
        id: string;
        mail?: string | null;
        userPrincipalName?: string | null;
        givenName?: string | null;
        surname?: string | null;
        department?: string | null;
      }[];
      '@odata.nextLink'?: string;
    };

    for (const u of json.value ?? []) {
      const email = (u.mail ?? u.userPrincipalName ?? '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      users.push({
        externalId: u.id,
        email,
        firstName: u.givenName?.trim() || email.split('@')[0],
        lastName: u.surname?.trim() || '—',
        department: u.department?.trim() ?? '',
        role: resolveRoleFromEnv(email, defaultRole),
      });
    }
    url = json['@odata.nextLink'] ?? null;
  }

  return { ok: true as const, users: await markExisting(users) };
}

export async function fetchLdapDirectoryUsers(
  config: LdapConnectionConfig
): Promise<{ ok: true; users: AdDirectoryUser[] } | { ok: false; error: string }> {
  try {
    const ldapts = await import('ldapts');
    const { Client } = ldapts;

    const client = new Client({
      url: config.url,
      tlsOptions: config.tlsRejectUnauthorized ? undefined : { rejectUnauthorized: false },
    });

    await client.bind(config.bindDn, config.bindPassword);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: 'sub',
      filter: config.userFilter,
      attributes: ['mail', 'userPrincipalName', 'givenName', 'sn', 'department', 'cn', 'distinguishedName'],
    });
    await client.unbind();

    const users: AdDirectoryUser[] = [];
    const seenEmails = new Set<string>();
    for (const entry of searchEntries) {
      const attrs = entry as Record<string, string | string[] | undefined>;
      const mail = pickAttr(attrs, 'mail', 'userPrincipalName');
      const email = (Array.isArray(mail) ? mail[0] : mail)?.trim().toLowerCase();
      if (!email || !email.includes('@') || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const given = pickAttr(attrs, 'givenName', 'cn');
      const sn = pickAttr(attrs, 'sn');
      const dept = pickAttr(attrs, 'department');
      const dn = pickAttr(attrs, 'distinguishedName');

      users.push({
        externalId: (Array.isArray(dn) ? dn[0] : dn) ?? email,
        email,
        firstName: (Array.isArray(given) ? given[0] : given)?.split(' ')[0] ?? email.split('@')[0],
        lastName: (Array.isArray(sn) ? sn[0] : sn) ?? '—',
        department: (Array.isArray(dept) ? dept[0] : dept) ?? '',
        role: resolveRoleFromEnv(email, config.defaultRole),
      });
    }

    return { ok: true, users: await markExisting(users) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'LDAP_ERROR';
    if (msg.includes('Cannot find module') || msg.includes('ldapts')) {
      return { ok: false, error: 'LDAP_MODULE_MISSING' };
    }
    return { ok: false, error: msg };
  }
}

function pickAttr(attrs: Record<string, string | string[] | undefined>, ...keys: string[]) {
  for (const k of keys) {
    const v = attrs[k];
    if (v) return v;
  }
  return undefined;
}

export async function previewAdUsers(input: {
  source: AdImportSource;
  ldap?: Omit<LdapConnectionConfig, 'bindPassword'> & { bindPassword?: string };
}): Promise<
  | { ok: true; users: AdDirectoryUser[]; source: AdImportSource }
  | { ok: false; error: string }
> {
  if (isMockDataEnabled()) {
    return { ok: true, users: await markExisting([...MOCK_AD_DIRECTORY]), source: input.source };
  }

  const settings = await getPlatformSettings();
  const defaultRole = settings.ldapDefaultRole;

  if (input.source === 'graph') {
    if (!isMicrosoftDirectoryConfigured()) {
      return { ok: false, error: 'GRAPH_NOT_CONFIGURED' };
    }
    const result = await fetchGraphDirectoryUsers(defaultRole);
    if (!result.ok) return result;
    return { ok: true, users: result.users, source: 'graph' };
  }

  const fullConfig = mergeLdapConnectionConfig(settings, input.ldap);

  if (!fullConfig.url || !fullConfig.bindDn || !fullConfig.bindPassword || !fullConfig.baseDn) {
    return { ok: false, error: 'LDAP_INCOMPLETE_CONFIG' };
  }

  const result = await fetchLdapDirectoryUsers(fullConfig);
  if (!result.ok) return result;
  return { ok: true, users: result.users, source: 'ldap' };
}

export async function testAdConnection(input: {
  source: AdImportSource;
  ldap?: Omit<LdapConnectionConfig, 'bindPassword'> & { bindPassword?: string };
}) {
  const preview = await previewAdUsers({ ...input });
  if (!preview.ok) return preview;
  return { ok: true as const, count: preview.users.length, source: preview.source };
}

export async function importAdUsers(
  emails: string[],
  previewUsers: AdDirectoryUser[],
  actorId: string
) {
  const toImport = previewUsers.filter((u) => emails.includes(u.email) && !u.alreadyExists);
  const settings = await getPlatformSettings();

  let created = 0;
  const errors: { email: string; error: string }[] = [];

  for (const u of toImport) {
    const res = await createUser(
      {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        department: u.department,
        password: settings.defaultImportPassword,
      },
      actorId
    );
    if (res.ok) created++;
    else errors.push({ email: u.email, error: res.error });
  }

  if (isMockDataEnabled()) {
    mockWriteAudit(actorId, 'admin.users.ad_import');
  } else {
    await writeAudit(actorId, 'admin.users.ad_import', undefined, { created, errors: errors.length });
  }

  return { ok: true as const, created, skipped: emails.length - toImport.length, errors };
}
