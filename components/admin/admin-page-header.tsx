import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** Pastille à gauche du titre (page Notifications). */
  mark?: ReactNode;
  className?: string;
  /** `flat` : titre sous le fil d’Ariane, sans bandeau dégradé. */
  variant?: 'hero' | 'flat';
};

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  mark,
  className,
  variant = 'hero',
}: Props) {
  return (
    <div className={cn('admin-hero', variant === 'flat' && 'admin-hero--flat', className)}>
      <div className={cn('min-w-0', mark && 'admin-hero-with-mark')}>
        {mark}
        <div className="min-w-0">
        {eyebrow ? <p className="admin-hero-eyebrow">{eyebrow}</p> : null}
        <h1 className="admin-hero-title">{title}</h1>
        {description ? <p className="admin-hero-description">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="admin-hero-actions">{actions}</div> : null}
    </div>
  );
}
