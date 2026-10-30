import type { NextAuthOptions } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { isPasswordExpired } from '@/lib/auth/password-policy';
import { isJwtSessionExpired, sessionExpiresAt } from '@/lib/auth/session-policy';
import { bumpUserSessionVersion, getUserSessionVersion } from '@/lib/auth/user-session-version';
import { recordUserLastLogin } from '@/lib/auth/record-user-last-login';
import { isAzureAdConfigured, upsertUserFromMicrosoft } from '@/lib/auth/microsoft-user';
import type { RoleId } from '@/lib/dg/role-ids';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockAuthenticate } from '@/lib/mock/users-store';
import { getPlatformSettings } from '@/lib/services/platform-settings';

const providers: Provider[] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      totpCode: { label: 'TOTP', type: 'text' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toString().trim().toLowerCase();
      const password = credentials?.password?.toString().trim() ?? '';
      const totpCode = credentials?.totpCode?.toString().trim() ?? '';
      if (!email || !password) return null;

      const settings = await getPlatformSettings();

      if (settings.twoFactorRequired) {
        return null;
      }

      if (isMockDataEnabled()) {
        const mock = mockAuthenticate(email, password);
        if (!mock) return null;

        const { mockGetTwoFactor } = await import('@/lib/mock/users-store');
        const { verifyTotpCode } = await import('@/lib/auth/totp');
        const tf = mockGetTwoFactor(mock.id);
        if (tf.enabled) {
          if (!totpCode || !tf.secret || !verifyTotpCode(tf.secret, totpCode)) return null;
        }

        let sessionVersion: number | undefined;
        if (settings.sessionSinglePerUser) {
          sessionVersion = await bumpUserSessionVersion(mock.id);
        }

        return {
          id: mock.id,
          email: mock.email,
          name: `${mock.firstName} ${mock.lastName}`,
          role: mock.role,
          firstName: mock.firstName,
          lastName: mock.lastName,
          department: mock.department,
          sessionVersion,
          sessionExp: sessionExpiresAt(settings),
          mustChangePassword: Boolean(mock.mustChangePassword),
        };
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash || !user.active || user.archived) return null;

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return null;

      if (!user.mustChangePassword && isPasswordExpired(user.passwordChangedAt, settings.passwordExpirationDays)) {
        return null;
      }

      const { userRequiresTwoFactor, verifyUserTotp } = await import(
        '@/lib/services/account-two-factor'
      );
      if (await userRequiresTwoFactor(email)) {
        if (!totpCode || !(await verifyUserTotp(email, totpCode))) return null;
      }

      await recordUserLastLogin(user.id);

      let sessionVersion: number | undefined;
      if (settings.sessionSinglePerUser) {
        sessionVersion = await bumpUserSessionVersion(user.id);
      }

      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department ?? '',
        sessionVersion,
        sessionExp: sessionExpiresAt(settings),
        mustChangePassword: user.mustChangePassword,
      };
    },
  }),
];

if (isAzureAdConfigured()) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: 'openid profile email User.Read offline_access',
        },
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        const settings = await getPlatformSettings();
        if (settings.twoFactorRequired) return false;
      }
      if (account?.provider === 'azure-ad') {
        const p = profile as {
          sub?: string;
          email?: string;
          name?: string;
          given_name?: string;
          family_name?: string;
        };
        const email = user.email ?? p.email;
        const dbUser = await upsertUserFromMicrosoft({
          id: account.providerAccountId ?? p.sub ?? user.id,
          email,
          name: user.name ?? p.name,
          given_name: p.given_name,
          family_name: p.family_name,
        });
        if (!dbUser) return false;
        user.id = dbUser.id;
        (user as { role?: RoleId }).role = dbUser.role;
        (user as { firstName?: string }).firstName = dbUser.firstName;
        (user as { lastName?: string }).lastName = dbUser.lastName;
        (user as { department?: string }).department = dbUser.department ?? '';
        await recordUserLastLogin(dbUser.id);
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      const settings = await getPlatformSettings();

      if (trigger === 'update' && session && typeof session === 'object') {
        const patch = session as { mustChangePassword?: boolean };
        if (patch.mustChangePassword === false) {
          token.mustChangePassword = false;
        }
      }

      if ((token as { invalid?: boolean }).invalid) {
        return token;
      }

      if (user) {
        const u = user as {
          role?: RoleId;
          department?: string;
          firstName?: string;
          lastName?: string;
          sessionVersion?: number;
          sessionExp?: number;
          mustChangePassword?: boolean;
        };
        token.role = u.role ?? 'MANAGER';
        token.department = u.department ?? '';
        token.firstName = u.firstName ?? '';
        token.lastName = u.lastName ?? '';
        token.mustChangePassword = Boolean(u.mustChangePassword);
        token.exp = u.sessionExp ?? sessionExpiresAt(settings);
        if (account?.provider === 'azure-ad') {
          token.sub = user.id;
          if (settings.sessionSinglePerUser && user.id) {
            token.sessionVersion = await bumpUserSessionVersion(user.id);
          }
        } else if (settings.sessionSinglePerUser && u.sessionVersion !== undefined) {
          token.sessionVersion = u.sessionVersion;
        }
      }

      if (isJwtSessionExpired(token)) {
        return { ...token, invalid: true };
      }

      if (token.sub && settings.sessionSinglePerUser && typeof token.sessionVersion === 'number') {
        const current = await getUserSessionVersion(token.sub);
        if (current !== token.sessionVersion) {
          return { ...token, invalid: true };
        }
      }

      return token;
    },
    async session({ session, token }) {
      if ((token as { invalid?: boolean }).invalid) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = (token.role as RoleId) ?? 'MANAGER';
        session.user.department = (token.department as string) ?? '';
        session.user.firstName = (token.firstName as string) ?? '';
        session.user.lastName = (token.lastName as string) ?? '';
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
};
