import type { ReactNode } from 'react'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { AuthAgendaMock } from '@/components/auth/auth-agenda-mock'
import { AuthLoginLogo } from '@/components/auth/auth-login-logo'
import { AuthHeroTitle } from '@/components/auth/auth-hero-title'
import { AppSecurityFooter } from '@/components/layout/app-security-footer'
import type { PlatformBranding } from '@/lib/dg/platform-branding'

type Props = {
  branding: PlatformBranding
  title: string
  subtitle: string
  children: ReactNode
  footerSlot?: ReactNode
}

const STEPS = [
  {
    index: '01',
    title: 'Demande',
    desc: 'Managers et invités soumettent le créneau.',
  },
  {
    index: '02',
    title: 'Validation',
    desc: 'L’assistante approuve, refuse ou reprogramme.',
  },
  {
    index: '03',
    title: 'Publication',
    desc: 'Agenda DGA synchronisé, sans conflit.',
  },
] as const

export function AuthPageShell({
  branding,
  title,
  subtitle,
  children,
  footerSlot,
}: Props) {
  const orgLabel = branding.organizationName || 'Direction Générale'

  return (
    <div className="admin-theme auth-login-page">
      <div className="auth-login-layout">
        <aside className="auth-login-hero" aria-label="Présentation">
          <div className="auth-login-hero-bg" aria-hidden />
          <div className="auth-login-hero-orb auth-login-hero-orb--a" aria-hidden />
          <div className="auth-login-hero-orb auth-login-hero-orb--b" aria-hidden />

          <div className="auth-login-hero-inner">
            <div className="auth-login-hero-brand">
              <div className="auth-login-logo-plate">
                <AuthLoginLogo
                  variant="hero"
                  institutionLogoUrl={branding.institutionLogoUrl}
                  organizationName={orgLabel}
                />
              </div>
              <div className="auth-login-hero-brand-text">
                <span className="auth-login-hero-brand-title">{orgLabel}</span>
                <span className="auth-login-hero-brand-sub">Plateforme de réservation</span>
              </div>
            </div>

            <div className="auth-login-hero-copyblock">
              <p className="auth-login-hero-badge">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                Espace réservation
              </p>
              <AuthHeroTitle
                prefix="L’agenda DGA,"
                words={['maîtrisé.', 'fiable.', 'synchrone.', 'sans conflit.']}
              />
              <p className="auth-login-hero-desc">
                Un parcours contrôlé de la demande à la publication — traçabilité, rôles et anti-chevauchement.
              </p>
            </div>

            <ol className="auth-login-hero-steps" aria-label="Parcours rendez-vous">
              {STEPS.map((step) => (
                <li key={step.index} className="auth-login-hero-step">
                  <span className="auth-login-hero-step-index" aria-hidden>
                    {step.index}
                  </span>
                  <div className="auth-login-hero-step-body">
                    <p className="auth-login-hero-step-title">{step.title}</p>
                    <p className="auth-login-hero-step-desc">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <AuthAgendaMock />

            <p className="auth-login-hero-copy">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Accès réservé · Autorité de Régulation des Postes et Télécommunications
            </p>
          </div>
        </aside>

        <div className="auth-login-main">
          <div className="auth-login-wrap">
            <div className="auth-login-head">
              <AuthLoginLogo
                variant="mobile"
                institutionLogoUrl={branding.institutionLogoUrl}
                organizationName={orgLabel}
              />
              <h2 className="auth-login-title">{title}</h2>
              <p className="auth-login-subtitle">{subtitle}</p>
            </div>

            {children}
            {footerSlot ?? (
              <AppSecurityFooter className="auth-login-page-footer" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
