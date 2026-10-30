'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GUINEA_FLAG_SRC = '/flags/gn.svg'

const WORKFLOW_SLIDES = [
  {
    id: 'request',
    index: '01',
    icon: CalendarPlus,
    kicker: 'Entrée du parcours',
    title: 'Demande de RDV',
    subtitle: 'Une demande claire, complète et priorisée',
    description:
      'Les managers et invités soumettent une demande structurée : priorité, type de rendez-vous, participants et créneau souhaité.',
    highlight:
      'Chaque demande arrive déjà prête pour arbitrage — moins d’allers-retours, plus de précision.',
    points: [
      { icon: Timer, label: 'Priorité et type définis' },
      { icon: Users, label: 'Participants ciblés' },
      { icon: CalendarPlus, label: 'Créneau proposé' },
    ],
    image: '/landing/workflow-request.webp?v=1',
    imageAlt: 'Professionnel soumettant une demande de rendez-vous',
    persona: 'Managers · Invités',
  },
  {
    id: 'review',
    index: '02',
    icon: CheckCircle2,
    kicker: 'Gouvernance active',
    title: 'Validation assistante',
    subtitle: 'Le contrôle humain avant toute publication',
    description:
      'Workflow obligatoire : approuver, refuser ou reprogrammer avant publication au calendrier DGA. Rien ne sort sans validation.',
    highlight:
      'L’assistante du DGA conserve la main : chaque décision est visible, justifiée et historisée.',
    points: [
      { icon: ShieldCheck, label: 'Contrôle par rôle' },
      { icon: CalendarClock, label: 'Reprogrammation guidée' },
      { icon: CheckCircle2, label: 'Décision tracée' },
    ],
    image: '/landing/workflow-validate.webp?v=1',
    imageAlt: 'Assistante validant les demandes de rendez-vous',
    persona: 'Assistante du DGA',
  },
  {
    id: 'sync',
    index: '03',
    icon: CalendarClock,
    kicker: 'Publication sécurisée',
    title: 'Synchronisation & anti-conflit',
    subtitle: 'Agenda publié, sans chevauchement',
    description:
      'Buffer de 15 minutes, détection automatique des conflits et publication immédiate sur le calendrier DGA dès validation.',
    highlight:
      'L’agenda reste cohérent en continu : zéro collision, synchronisation instantanée, équipe alignée.',
    points: [
      { icon: Timer, label: 'Buffer 15 min' },
      { icon: ShieldCheck, label: 'Zéro chevauchement' },
      { icon: CalendarClock, label: 'Publication automatique' },
    ],
    image: '/landing/workflow-sync.webp?v=1',
    imageAlt: 'Équipe synchronisant le calendrier sans conflit',
    persona: 'Agenda DGA · Équipes',
  },
] as const

const SLIDE_MS = 5600

export function LandingWorkflowSlider() {
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
      setIndex((current) => (current + 1) % WORKFLOW_SLIDES.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [paused, reducedMotion, index])

  const goTo = useCallback((next: number) => {
    setIndex((next + WORKFLOW_SLIDES.length) % WORKFLOW_SLIDES.length)
  }, [])

  const slide = WORKFLOW_SLIDES[index]
  const Icon = slide.icon

  return (
    <section
      className="landing-page-features landing-workflow-slider"
      aria-labelledby="landing-features-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="landing-page-features-head landing-page-animate landing-page-animate--8">
        <span className="landing-workflow-eyebrow">
          Gestion des rendez-vous · ARPT
        </span>
        <h2 id="landing-features-title" className="landing-page-features-title">
          Un parcours maîtrisé de bout en bout
        </h2>
        <p className="landing-page-features-desc">
          De la demande à la publication sur l&apos;agenda, chaque étape est contrôlée, tracée et
          portée par les bons interlocuteurs.
        </p>
      </div>

      <div className="landing-workflow-stage">
        <article
          key={slide.id}
          className="landing-workflow-featured landing-page-animate landing-page-animate--9"
          aria-live="polite"
        >
          <div className="landing-workflow-media">
            {WORKFLOW_SLIDES.map((item, i) => (
              <div
                key={item.id}
                className={cn('landing-workflow-media-slide', i === index && 'is-active')}
                aria-hidden={i !== index}
              >
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 900px) 100vw, 42rem"
                  className="landing-workflow-media-img"
                  priority={i === 0}
                />
              </div>
            ))}
            <div className="landing-workflow-media-veil" aria-hidden />
            <div className="landing-workflow-media-meta">
              <span className="landing-workflow-media-step">Étape {slide.index}</span>
              <span className="landing-workflow-media-persona">{slide.persona}</span>
            </div>
          </div>

          <div className="landing-workflow-copy">
            <div className="landing-workflow-featured-top">
              <span className="landing-workflow-featured-index">{slide.index}</span>
              <span className="landing-workflow-featured-icon" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <span className="landing-workflow-kicker">{slide.kicker}</span>
            <h3 className="landing-workflow-featured-title">{slide.title}</h3>
            <p className="landing-workflow-featured-subtitle">{slide.subtitle}</p>
            <p className="landing-workflow-featured-desc">{slide.description}</p>
            <p className="landing-workflow-featured-highlight">{slide.highlight}</p>
            <ul className="landing-workflow-featured-points">
              {slide.points.map((point) => {
                const PointIcon = point.icon
                return (
                  <li key={point.label}>
                    <PointIcon className="h-3 w-3" aria-hidden />
                    {point.label}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="landing-workflow-progress" aria-hidden>
            <span
              key={`${slide.id}-progress`}
              className={cn(
                'landing-workflow-progress-bar',
                (paused || reducedMotion) && 'is-paused',
              )}
              style={
                !paused && !reducedMotion
                  ? { animationDuration: `${SLIDE_MS}ms` }
                  : undefined
              }
            />
          </div>
        </article>

        <div className="landing-workflow-rail" role="tablist" aria-label="Étapes du parcours">
          {WORKFLOW_SLIDES.map((item, i) => {
            const StepIcon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={cn('landing-workflow-thumb', i === index && 'is-active')}
                onClick={() => goTo(i)}
              >
                <span className="landing-workflow-thumb-photo">
                  <Image
                    src={item.image}
                    alt=""
                    width={72}
                    height={48}
                    className="landing-workflow-thumb-img"
                  />
                </span>
                <span className="landing-workflow-thumb-body">
                  <span className="landing-workflow-thumb-index">{item.index}</span>
                  <span className="landing-workflow-thumb-title">{item.title}</span>
                  <span className="landing-workflow-thumb-kicker">{item.kicker}</span>
                </span>
                <span className="landing-workflow-thumb-icon" aria-hidden>
                  <StepIcon className="h-3.5 w-3.5" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="landing-workflow-nav">
        <button
          type="button"
          className="landing-hero-nav-btn"
          onClick={() => goTo(index - 1)}
          aria-label="Étape précédente"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
        <p className="landing-workflow-nav-label">
          Étape {index + 1} / {WORKFLOW_SLIDES.length}
        </p>
        <button
          type="button"
          className="landing-hero-nav-btn"
          onClick={() => goTo(index + 1)}
          aria-label="Étape suivante"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </section>
  )
}
