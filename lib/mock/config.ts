/**
 * Active les données mock côté serveur (auth + API + persistance).
 * Seul USE_MOCK_DATA compte ici — NEXT_PUBLIC_USE_MOCK_DATA ne sert qu’aux bannières UI.
 */
export function isMockDataEnabled(): boolean {
  return process.env.USE_MOCK_DATA === 'true';
}

/** Bannière « mode démo » côté client (n’affecte pas MySQL). */
export function isPublicMockBannerEnabled(): boolean {
  return (
    process.env.USE_MOCK_DATA === 'true' ||
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
  );
}
