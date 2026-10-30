'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import type { ReformulateRequestResult } from '@/lib/ai/types';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description: string;
  justification?: string;
  urgencyLevel?: UrgencyLevel;
  type?: string;
  onApply: (result: ReformulateRequestResult) => void;
  className?: string;
  size?: 'sm' | 'default';
};

export function AssistantAiReformulateButton({
  title,
  description,
  justification,
  urgencyLevel,
  type,
  onApply,
  className,
  size = 'sm',
}: Props) {
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!title.trim() && !description.trim()) {
      toast({
        title: 'Champs vides',
        description: 'Saisissez au moins un titre ou une description à reformuler.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/appointments/reformulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, justification, urgencyLevel, type }),
      });
      if (!res.ok) throw new Error('failed');
      const json = (await res.json()) as { mode: string; data: ReformulateRequestResult };
      onApply(json.data);
      toast({
        title: json.mode === 'ai' ? 'Reformulation IA' : 'Reformulation assistée',
        description: json.data.changes[0] ?? 'Texte mis à jour.',
      });
    } catch {
      toast({
        title: 'Échec',
        description: 'Impossible de reformuler la demande.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn('dg-ai-reformulate-btn', className)}
      onClick={() => void run()}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      )}
      Reformuler avec l&apos;IA
    </Button>
  );
}
