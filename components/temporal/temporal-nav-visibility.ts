const HIDE_TEMPORAL_NAV_PATHS = new Set([
  '/dg/appointments/analytics',
  '/account',
  '/appointments/mine',
  '/dg/availability/reservations/mine',
]);

export function shouldShowGlobalTemporalNav(pathname: string | null): boolean {
  if (!pathname) return false;
  return !HIDE_TEMPORAL_NAV_PATHS.has(pathname);
}
