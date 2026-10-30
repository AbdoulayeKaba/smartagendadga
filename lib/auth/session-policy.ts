import type { PlatformConfig } from '@/lib/dg/platform-config';

export function sessionMaxAgeSeconds(config: Pick<PlatformConfig, 'sessionExpirationMinutes'>): number {
  return Math.max(5, config.sessionExpirationMinutes) * 60;
}

export function sessionExpiresAt(config: Pick<PlatformConfig, 'sessionExpirationMinutes'>): number {
  return Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds(config);
}

/** Vérifie l’expiration JWT (paramètre « Expiration de session »). */
export function isJwtSessionExpired(token: { exp?: number | null }): boolean {
  if (typeof token.exp !== 'number' || token.exp <= 0) return false;
  return Math.floor(Date.now() / 1000) >= token.exp;
}
