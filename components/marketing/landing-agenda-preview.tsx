import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  User,
  Users,
} from 'lucide-react'

/** Créneaux fictifs — aperçu marketing uniquement, sans données d'agenda. */
const ILLUSTRATION_SLOTS = [
  {
    time: '09:00',
    title: 'Comité de direction',
    meta: 'En attente · Priorité haute',
    tone: 'pending' as const,
    icon: Users,
  },
  {
    time: '11:30',
    title: 'Audience partenaire',
    meta: 'Validé · Confirmé',
    tone: 'approved' as const,
    icon: User,
  },
  {
    time: '15:00',
    title: 'Créneau libre',
    meta: 'Disponible · Buffer 15 min',
    tone: 'free' as const,
    icon: Clock,
  },
] as const

/** Widget décoratif — aucun chargement du calendrier DGA ni des rendez-vous. */
export function LandingAgendaPreview() {
  return (
    <aside
      className="landing-page-preview"
      role="img"
      aria-label="Aperçu illustratif de l'agenda, sans données réelles"
    >
      <div className="landing-page-preview-chrome" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="landing-page-preview-header">
        <span className="landing-page-preview-header-title">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Aujourd&apos;hui
        </span>
        <span className="landing-page-preview-header-select" aria-hidden>
          Cette semaine
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        </span>
      </div>

      <div className="landing-page-preview-body">
        <div className="landing-page-preview-main">
          {ILLUSTRATION_SLOTS.map((slot) => {
            const SlotIcon = slot.icon
            return (
              <div
                key={slot.time}
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
      </div>

      <Link href="/login" className="landing-page-preview-footer">
        Voir le calendrier complet
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </aside>
  )
}
