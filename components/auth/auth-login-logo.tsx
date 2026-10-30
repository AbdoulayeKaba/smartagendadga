import { Briefcase, Clock3 } from 'lucide-react';
import { InstitutionLogoImage } from '@/components/layout/institution-logo-image';
import { cn } from '@/lib/utils';

type Props = {
  institutionLogoUrl: string;
  organizationName: string;
  variant?: 'hero' | 'mobile';
};

export function AuthLoginLogo({
  institutionLogoUrl,
  organizationName,
  variant = 'mobile',
}: Props) {
  const isHero = variant === 'hero';
  const hasLogo = Boolean(institutionLogoUrl?.trim());

  return (
    <div
      className={cn(
        'auth-login-logo',
        isHero ? 'auth-login-logo--hero' : 'auth-login-logo--mobile',
        hasLogo && 'auth-login-logo--has-image'
      )}
    >
      {hasLogo ? (
        <InstitutionLogoImage
          src={institutionLogoUrl}
          alt={organizationName}
          className="auth-login-logo-img"
        />
      ) : isHero ? (
        <Clock3 className="auth-login-logo-clock" aria-hidden />
      ) : (
        <Briefcase className="auth-login-logo-fallback" aria-hidden />
      )}
    </div>
  );
}
