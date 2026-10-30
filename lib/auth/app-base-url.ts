/** URL publique de l’application (liens dans les e-mails). */
export function resolveAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const port = process.env.PORT?.trim() || '3000';
  return `http://localhost:${port}`;
}
