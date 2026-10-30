import { isMockDataEnabled } from '@/lib/mock/config';

/** Accès sans connexion (pages + API DG). DISABLE_AUTH ou mode mock données. */
export function isAuthDisabled(): boolean {
  return (
    process.env.DISABLE_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ||
    isMockDataEnabled() ||
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
  );
}
