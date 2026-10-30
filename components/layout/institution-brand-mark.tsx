'use client';

import { Briefcase } from 'lucide-react';
import { InstitutionLogoImage } from '@/components/layout/institution-logo-image';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  showText?: boolean;
  subtitle?: string;
  compact?: boolean;
  logoClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function InstitutionBrandMark({
  className,
  showText = true,
  subtitle = 'Plateforme de réservation',
  compact = false,
  logoClassName,
  titleClassName,
  subtitleClassName,
}: Props) {
  const { branding } = useApp();
  const { organizationName, institutionLogoUrl } = branding;

  return (
    <div className={cn('flex shrink-0 items-center', compact ? 'gap-1.5' : 'gap-2.5', className)}>
      <div
        className={cn(
          'flex items-center justify-center',
          institutionLogoUrl
            ? cn(
                'overflow-hidden border-0 bg-transparent shadow-none',
                compact ? 'h-6 w-auto max-w-[3rem]' : 'h-8 w-auto max-w-[6.5rem]'
              )
            : cn(
                'overflow-hidden esmt-gradient-orange',
                compact ? 'h-9 w-9 rounded-lg shadow-sm' : 'h-11 w-11 rounded-xl shadow-md'
              ),
          logoClassName
        )}
      >
        {institutionLogoUrl ? (
          <InstitutionLogoImage
            src={institutionLogoUrl}
            alt=""
            className="h-full w-auto max-w-full object-contain object-left-top"
          />
        ) : (
          <Briefcase className={cn('text-white', compact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden />
        )}
      </div>
      {showText ? (
        <div className="min-w-0">
          <p
            className={cn(
              'truncate font-bold text-emerald-700',
              compact ? 'text-[11px] leading-tight' : 'text-sm leading-none',
              titleClassName
            )}
          >
            {organizationName}
          </p>
          {subtitle ? (
            <p
              className={cn(
                'truncate text-muted-foreground',
                compact ? 'mt-0 text-[8px] leading-tight' : 'mt-0.5 text-[10px]',
                subtitleClassName
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
