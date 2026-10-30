'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Pause,
  Play,
  Shield,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { LandingWorkflowVideoTrigger } from '@/components/marketing/landing-workflow-video-trigger'
import { cn } from '@/lib/utils'

const TRUST_POINTS = [
  { label: 'Agenda intelligent', icon: Brain, tone: 'green' as const },
  { label: 'Contrôle par rôle', icon: Shield, tone: 'gold' as const },
  { label: 'Traçabilité complète', icon: FileText, tone: 'red' as const },
] as const

type SlotTone = 'pending' | 'approved' | 'free'

type PreviewSlot = {
  time: string
  title: string
  meta: string
  tone: SlotTone
  icon: typeof Users
}

const HERO_SLIDES = [
  {
    id: 'plan',
    kicker: 'Planification',
    tone: 'green' as const,
    title: 'Agenda DGA maîtrisé de la demande à la publication',
    lead: 'Planification intelligente, validation assistante, synchronisation calendrier et zéro conflit d’agenda.',
    badge: 'Agenda live',
    caption: 'Vue agenda · demande à publication',
    previewTitle: 'Aujourd’hui',
    previewSelect: 'Cette semaine',
    mode: 'agenda' as const,
    icon: CalendarPlus,
    slots: [
      {
        time: '09:00',
        title: 'Comité de direction',
        meta: 'En attente · Priorité haute',
        tone: 'pending',
        icon: Users,
      },
      {
        time: '11:30',
        title: 'Audience partenaire',
        meta: 'Validé · Confirmé',
        tone: 'approved',
        icon: User,
      },
      {
        time: '15:00',
        title: 'Créneau libre',
        meta: 'Disponible · Buffer 15 min',
        tone: 'free',
        icon: Clock,
      },
    ] satisfies PreviewSlot[],
  },
  {
    id: 'validate',
    kicker: 'Gouvernance',
    tone: 'gold' as const,
    title: 'Chaque demande passe par une validation assistante',
    lead: 'Approuver, refuser ou reprogrammer avant publication : le contrôle par rôle protège l’agenda du DGA.',
    badge: 'Workflow',
    caption: 'File de validation · contrôle par rôle',
    previewTitle: 'File de validation',
    previewSelect: 'Priorité',
    mode: 'workflow' as const,
    icon: ShieldCheck,
    slots: [
      {
        time: '10:15',
        title: 'Brief cabinet',
        meta: 'À traiter · Urgent',
        tone: 'pending',
        icon: ShieldCheck,
      },
      {
        time: '13:00',
        title: 'Réunion secteur',
        meta: 'Reprogrammé · +1 j',
        tone: 'pending',
        icon: Users,
      },
      {
        time: '16:30',
        title: 'Audience validée',
        meta: 'Publiée · Agenda DGA',
        tone: 'approved',
        icon: CheckCircle2,
      },
    ] satisfies PreviewSlot[],
  },
  {
    id: 'sync',
    kicker: 'Anti-conflit',
    tone: 'red' as const,
    title: 'Synchronisation calendrier et zéro chevauchement',
    lead: 'Buffer automatique, détection des conflits et publication immédiate dès validation.',
    badge: '0 conflit',
    caption: 'Sync calendrier · buffer 15 min',
    previewTitle: 'Calendrier DGA',
    previewSelect: 'Vue jour',
    mode: 'sync' as const,
    icon: CalendarClock,
    slots: [
      {
        time: '08:45',
        title: 'Buffer de sécurité',
        meta: '15 min · Protégé',
        tone: 'free',
        icon: Clock,
      },
      {
        time: '09:00',
        title: 'Comité publié',
        meta: 'Synchronisé · Sans conflit',
        tone: 'approved',
        icon: Calendar,
      },
      {
        time: '14:00',
        title: 'Créneau ouvert',
        meta: 'Disponible · Suggestion IA',
        tone: 'free',
        icon: Brain,
      },
    ] satisfies PreviewSlot[],
  },
] as const

const SLIDE_MS = 5600

export function LandingHeroSlider() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (paused || reducedMotion) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SLIDES.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [paused, reducedMotion, index])

  const goTo = useCallback((next: number) => {
    setIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length)
  }, [])

  const slide = HERO_SLIDES[index]
  const ThumbIcon = slide.icon

  return (
    <div
      className="landing-page-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="landing-page-hero-rings" aria-hidden />
      <div className="landing-page-hero-orb" aria-hidden />

      <div className="landing-page-hero-copy">
        <div className="landing-page-eyebrow landing-page-animate landing-page-animate--2">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
          Autorité de Régulation des Postes et Télécommunications
        </div>

        <div className="landing-hero-slide-panel" aria-live="polite">
          <span className="landing-hero-slide-kicker">{slide.kicker}</span>
          <h1
            key={`${slide.id}-title`}
            className="landing-page-title landing-hero-slide-title"
          >
            {slide.title}
          </h1>
          <p
            key={`${slide.id}-lead`}
            className="landing-page-lead landing-hero-slide-lead"
          >
            {slide.lead}
          </p>
        </div>

        <div className="landing-page-cta-row landing-page-animate landing-page-animate--5">
          <Link href="/login" className="landing-page-cta">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Accéder à l&apos;agenda
          </Link>
          <LandingWorkflowVideoTrigger />
        </div>

        <ul className="landing-page-trust landing-page-animate landing-page-animate--6" aria-label="Points clés">
          {TRUST_POINTS.map((point) => {
            const TrustIcon = point.icon
            return (
              <li key={point.label} className={`landing-page-trust-item landing-page-trust-item--${point.tone}`}>
                <TrustIcon className="h-3 w-3 shrink-0" aria-hidden />
                {point.label}
              </li>
            )
          })}
        </ul>

        <div className="landing-hero-controls" role="group" aria-label="Diaporama hero">
          <button
            type="button"
            className="landing-hero-nav-btn"
            onClick={() => goTo(index - 1)}
            aria-label="Slide précédent"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>

          <div className="landing-hero-dots">
            {HERO_SLIDES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={cn('landing-hero-dot', i === index && 'is-active')}
                onClick={() => goTo(i)}
                aria-label={`Aller au slide ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <span
                  className="landing-hero-dot-progress"
                  style={
                    i === index && !paused && !reducedMotion
                      ? { animationDuration: `${SLIDE_MS}ms` }
                      : undefined
                  }
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="landing-hero-nav-btn"
            onClick={() => goTo(index + 1)}
            aria-label="Slide suivant"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>

          <button
            type="button"
            className="landing-hero-pause"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Reprendre le diaporama' : 'Mettre en pause'}
          >
            {paused ? (
              <Play className="h-3 w-3" aria-hidden />
            ) : (
              <Pause className="h-3 w-3" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="landing-page-preview-wrap landing-page-animate landing-page-animate--7">
        <div className="landing-hero-ui" aria-roledescription="carousel">
          <aside
            key={slide.id}
            className={cn(
              'landing-page-preview landing-hero-preview',
              `landing-hero-preview--${slide.mode}`,
            )}
            role="img"
            aria-label={`Aperçu produit — ${slide.kicker}`}
          >
            <div className="landing-page-preview-chrome" aria-hidden>
              <span />
              <span />
              <span />
            </div>

            <div className="landing-page-preview-header">
              <span className="landing-page-preview-header-title">
                <ThumbIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {slide.previewTitle}
              </span>
              <span className="landing-hero-ui-badge">{slide.badge}</span>
            </div>

            <div className="landing-page-preview-body">
              <div className="landing-hero-ui-meta">
                <span className="landing-hero-ui-meta-select" aria-hidden>
                  {slide.previewSelect}
                  <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                </span>
                <span className="landing-hero-ui-meta-caption">{slide.caption}</span>
              </div>

              <div className="landing-page-preview-main">
                {slide.slots.map((slot) => {
                  const SlotIcon = slot.icon
                  return (
                    <div
                      key={`${slide.id}-${slot.time}`}
                      className={`landing-page-preview-slot landing-page-preview-slot--${slot.tone}`}
                    >
                      <span className="landing-page-preview-time">{slot.time}</span>
                      <div className="landing-page-preview-slot-copy">
                        <strong>{slot.title}</strong>
                        <small>{slot.meta}</small>
                      </div>
                      <span
                        className={`landing-page-preview-slot-icon landing-page-preview-slot-icon--${slot.tone}`}
                        aria-hidden
                      >
                        <SlotIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )
                })}
              </div>

              {slide.mode === 'sync' ? (
                <div className="landing-hero-ui-sync" aria-hidden>
                  <span>Buffer 15 min</span>
                  <span>0 chevauchement</span>
                  <span>Publié</span>
                </div>
              ) : null}

              {slide.mode === 'workflow' ? (
                <div className="landing-hero-ui-actions" aria-hidden>
                  <span className="is-approve">Approuver</span>
                  <span className="is-reschedule">Reprogrammer</span>
                  <span className="is-reject">Refuser</span>
                </div>
              ) : null}
            </div>

            <Link href="/login" className="landing-page-preview-footer">
              Voir le calendrier complet
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </aside>

          <div className="landing-hero-thumbs landing-hero-thumbs--ui" role="tablist" aria-label="Vues produit">
            {HERO_SLIDES.map((item, i) => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={cn(
                    'landing-hero-thumb landing-hero-thumb--ui',
                    `landing-hero-thumb--${item.tone}`,
                    i === index && 'is-active',
                  )}
                  onClick={() => goTo(i)}
                  aria-label={item.kicker}
                >
                  <span className="landing-hero-thumb-icon" aria-hidden>
                    <ItemIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="landing-hero-thumb-label">{item.kicker}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
