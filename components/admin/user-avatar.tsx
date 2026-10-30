'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { userInitials } from '@/lib/dg/role-labels';

type Props = {
  firstName: string;
  lastName: string;
  /** URL publique (ex. /api/users/:id/avatar?v=…). Sans URL → initiales. */
  avatarUrl?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
};

export function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  className,
  size = 'md',
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = userInitials(firstName, lastName);
  const src = avatarUrl?.trim() || '';
  const showPhoto = Boolean(src) && !imgFailed;

  return (
    <div
      className={cn(
        'admin-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-[var(--admin-primary)]',
        size === 'xs' && 'h-6 w-6 text-[0.5625rem]',
        size === 'sm' && 'h-8 w-8 text-[11px]',
        size === 'md' && 'h-10 w-10 text-sm',
        className
      )}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL dynamique avatar utilisateur
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
