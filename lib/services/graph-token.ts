export function getMicrosoftAppCredentials() {
  const tenant = process.env.GRAPH_TENANT_ID ?? process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID ?? process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET ?? process.env.AZURE_AD_CLIENT_SECRET;
  return { tenant, clientId, clientSecret };
}

export function isMicrosoftDirectoryConfigured() {
  const { tenant, clientId, clientSecret } = getMicrosoftAppCredentials();
  return Boolean(tenant && clientId && clientSecret);
}

export async function getMicrosoftGraphToken(): Promise<string | null> {
  const { tenant, clientId, clientSecret } = getMicrosoftAppCredentials();
  if (!tenant || !clientId || !clientSecret) return null;

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}
