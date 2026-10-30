'use client';

import { useApp } from '@/lib/app-context';
import type { DgRole } from '@/lib/dg/rbac';

/**
 * Rôle DGA stable SSR / hydratation : priorité au contexte serveur (sessionBacked).
 * Évite les écarts avec useSession() côté client qui désynchronisent la navigation Radix.
 */
export function useDgRole(): DgRole {
  const ctx = useApp();
  if (ctx.sessionBacked && ctx.dgRole) return ctx.dgRole;
  return ctx.dgRole ?? 'ASSISTANT';
}
