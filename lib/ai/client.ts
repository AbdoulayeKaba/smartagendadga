import { getAiModel, isAiProviderConfigured } from '@/lib/ai/config';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function completeChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  if (!isAiProviderConfigured()) return null;

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getAiModel(),
      messages,
      temperature: options?.temperature ?? 0.35,
      max_tokens: options?.maxTokens ?? 1200,
    }),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = json.choices?.[0]?.message?.content?.trim();
  return content || null;
}

export function parseJsonFromLlm<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
