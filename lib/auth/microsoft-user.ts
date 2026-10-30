import { prisma } from '@/lib/prisma';
import type { DgRole } from '@/lib/dg/rbac';
import { hashPassword } from '@/lib/auth/password';

type MicrosoftProfile = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  department?: string | null;
};

function parseName(profile: MicrosoftProfile) {
  if (profile.given_name && profile.family_name) {
    return { firstName: profile.given_name, lastName: profile.family_name };
  }
  const parts = (profile.name ?? 'Utilisateur Microsoft').split(' ');
  return {
    firstName: parts[0] ?? 'Utilisateur',
    lastName: parts.slice(1).join(' ') || 'Microsoft',
  };
}

function resolveRoleFromEnv(email: string): DgRole {
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
  return 'MANAGER';
}

/** Crée ou met à jour un utilisateur après connexion Microsoft. */
export async function upsertUserFromMicrosoft(profile: MicrosoftProfile) {
  const email = profile.email?.toLowerCase();
  if (!email) return null;

  const { firstName, lastName } = parseName(profile);
  const role = resolveRoleFromEnv(email);
  const microsoftId = profile.id ?? undefined;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(microsoftId ? [{ microsoftId }] : []),
      ],
    },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        microsoftId: microsoftId ?? existing.microsoftId,
        firstName,
        lastName,
        department: profile.department ?? existing.department,
      },
    });
  }

  const placeholderHash = await hashPassword(`ms-${microsoftId ?? email}-${Date.now()}`);

  return prisma.user.create({
    data: {
      email,
      microsoftId: microsoftId ?? null,
      passwordHash: placeholderHash,
      firstName,
      lastName,
      role,
      department: profile.department ?? null,
    },
  });
}

export function isAzureAdConfigured() {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
      process.env.AZURE_AD_CLIENT_SECRET &&
      process.env.AZURE_AD_TENANT_ID
  );
}
