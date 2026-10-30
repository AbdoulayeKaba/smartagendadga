'use client';

import type { MouseEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { getMailWorkflowAdvanceAction } from '@/lib/workspace/mail-utils';
import { cn } from '@/lib/utils';
import type { MailItem, MailWorkflowStatus } from '@/lib/workspace/types';

type Props = {
  mail: MailItem;
  loading?: boolean;
  onAdvance: (
    mailId: string,
    status: MailWorkflowStatus,
    patch: Record<string, unknown>
  ) => void | Promise<void>;
  variant?: 'detail' | 'detail-inline' | 'tracking';
  className?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function MailWorkflowAdvanceButton({
  mail,
  loading = false,
  onAdvance,
  variant = 'detail',
  className,
  onClick,
}: Props) {
  const action = getMailWorkflowAdvanceAction(mail);
  if (!action) return null;

  return (
    <button
      type="button"
      className={cn(
        variant === 'tracking' && 'mail-tracking-advance-btn',
        variant === 'detail' && 'mail-detail-footer-btn mail-detail-footer-btn--primary mail-detail-footer-btn--advance',
        variant === 'detail-inline' && 'mail-detail-exec-advance-btn',
        className
      )}
      disabled={loading}
      title={`${action.label} (${action.targetLabel})`}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
        if (event.defaultPrevented) return;
        void onAdvance(mail.id, action.nextStatus, action.patch);
      }}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      )}
      <span>{action.label}</span>
    </button>
  );
}
