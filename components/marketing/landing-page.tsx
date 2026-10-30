import Link from 'next/link'
import { BarChart3, Clock, Lock, ShieldCheck, Zap } from 'lucide-react'
import type { PlatformBranding } from '@/lib/dg/platform-branding'
import { LandingHeroSlider } from '@/components/marketing/landing-hero-slider'
import { LandingWorkflowSlider } from '@/components/marketing/landing-workflow-slider'
import './landing-page.css'

const KPI_CARDS = [
  {
    value: '24/7',
    label: 'Disponibilité',
    hint: 'Accès en continu et sécurisé',
    icon: Clock,
    tone: 'green' as const,
  },
  {
    value: '< 2 min',
    label: 'Temps moyen de traitement',
    hint: 'Validation rapide et efficace',
    icon: Zap,
    tone: 'gold' as const,
  },
  {
    value: '0 conflit',
    label: 'Agenda sans chevauchement',
    hint: 'Planification optimisée',
    icon: ShieldCheck,
    tone: 'teal' as const,
  },
  {
    value: '100%',
    label: 'Traçabilité & historique',
    hint: 'Suivi complet de toutes les actions',
    icon: BarChart3,
    tone: 'navy' as const,
  },
] as const

export function LandingPage({ branding }: { branding: PlatformBranding }) {
  const { organizationName, institutionLogoUrl } = branding
  const hasLogo = Boolean(institutionLogoUrl?.trim())

  return (
    <div className="landing-page admin-theme">
      <div className="landing-page-bg" aria-hidden />
      <div className="landing-page-grid" aria-hidden />

      <div
        className="landing-page-header"
        role="banner"
      >
        <div className="landing-page-brand">
          <div className="landing-page-brand-mark">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={institutionLogoUrl}
                alt="ARPT"
                className="institution-logo-img landing-page-brand-logo"
              />
            ) : (
              <span className="landing-page-brand-logo-fallback">ARPT</span>
            )}
          </div>
          <span className="landing-page-brand-sep" aria-hidden />
          <div className="landing-page-brand-text">
            <span className="landing-page-brand-title">{organizationName}</span>
            <span className="landing-page-brand-sub">Système de gestion des rendez-vous</span>
          </div>
        </div>
        <div className="landing-page-header-actions">
          <Link href="/login" className="landing-page-header-link">
            Se connecter
            <Lock className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="landing-page-shell">
        <LandingHeroSlider />
        <LandingWorkflowSlider />

        <section className="landing-page-stats" aria-label="Indicateurs clés">
          {KPI_CARDS.map((card, index) => {
            const StatIcon = card.icon
            return (
              <article
                key={card.label}
                className={`landing-page-stat landing-page-animate landing-page-animate--${12 + index}`}
              >
                <span className={`landing-page-stat-icon landing-page-stat-icon--${card.tone}`}>
                  <StatIcon className="h-4 w-4" aria-hidden />
                </span>
                <div className="landing-page-stat-copy">
                  <p className="landing-page-stat-value">{card.value}</p>
                  <p className="landing-page-stat-label">{card.label}</p>
                  <p className="landing-page-stat-hint">{card.hint}</p>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
