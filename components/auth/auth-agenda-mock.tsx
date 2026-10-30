import {
  CalendarRange,
  LockKeyhole,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'

const HIGHLIGHTS = [
  {
    icon: CalendarRange,
    title: 'Planification',
    desc: 'Demandes et priorités centralisées.',
  },
  {
    icon: Waypoints,
    title: 'Validation',
    desc: 'Workflow avant publication.',
  },
  {
    icon: LockKeyhole,
    title: 'Accès par rôle',
    desc: 'Droits et traçabilité.',
  },
  {
    icon: ShieldCheck,
    title: 'Anti-conflit',
    desc: 'Buffer et chevauchement.',
  },
] as const

/** Bloc décoratif login — aucune donnée de rendez-vous DGA. */
export function AuthAgendaMock() {
  return (
    <div className="auth-login-hero-preview" aria-hidden>
      <div className="auth-login-highlights">
        <div className="auth-login-highlights-head">
          <span>Capacités plateforme</span>
          <span className="auth-login-highlights-secure">Sécurisé</span>
        </div>
        <ul className="auth-login-highlights-grid">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.title} className="auth-login-highlight">
                <span className="auth-login-highlight-icon">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="auth-login-highlight-title">{item.title}</p>
                  <p className="auth-login-highlight-desc">{item.desc}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
