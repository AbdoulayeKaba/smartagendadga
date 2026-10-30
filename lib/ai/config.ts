export function isAiProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getAiModel(): string {
  return process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
}
